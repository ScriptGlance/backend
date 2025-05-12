import {BadRequestException, ConflictException, HttpStatus, Injectable, NotFoundException} from '@nestjs/common';
import { InjectRepository } from "@nestjs/typeorm";
import { UserEntity } from "../common/entities/UserEntity";
import {Brackets, MoreThan, ObjectLiteral, Repository, SelectQueryBuilder} from "typeorm";
import { StandardResponse } from "../common/interface/StandardResponse";
import { UserDto } from "../user/dto/UserDto";
import { UserMapper } from "../user/user.mapper";
import { UserWithPremiumEntity } from "../common/entities/UserWithPremiumEntity";
import { ModeratorEntity } from "../common/entities/ModeratorEntity";
import { ModeratorDto } from "../moderator/dto/ModeratorDto";
import { ModeratorMapper } from "../moderator/moderator.mapper";
import {ChatEntity} from "../common/entities/ChatEntity";
import {InviteDto} from "./dto/InviteDto";
import {EmailService} from "../email/email.service";
import * as bcrypt from "bcryptjs";
import {randomBytes} from "crypto";
import {StatisticsItemDto} from "./dto/StatisticsItemDto";
import {PresentationEntity} from "../common/entities/PresentationEntity";
import {VideoEntity} from "../common/entities/VideoEntity";
import {PresentationStartEntity} from "../common/entities/PresentationStartEntity";

interface PaginationParams<TSortField> {
    limit: number;
    offset: number;
    sort: TSortField;
    order: 'asc' | 'desc';
    search: string;
}

@Injectable()
export class AdminService {
    constructor(
        @InjectRepository(UserEntity)
        private readonly userRepository: Repository<UserEntity>,
        @InjectRepository(ModeratorEntity)
        private readonly moderatorRepository: Repository<ModeratorEntity>,
        @InjectRepository(ChatEntity)
        private readonly chatRepository: Repository<ChatEntity>,
        @InjectRepository(PresentationStartEntity)
        private readonly presentationStartRepository: Repository<PresentationStartEntity>,
        @InjectRepository(VideoEntity)
        private readonly videoRepository: Repository<VideoEntity>,
        private readonly userMapper: UserMapper,
        private readonly moderatorMapper: ModeratorMapper,
        private readonly emailService: EmailService,
    ) {}

    async getUsers(
        params: PaginationParams<'registeredAt' | 'name' | 'email'>,
    ): Promise<StandardResponse<UserDto[]>> {
        const builder = this.userRepository.createQueryBuilder('user')
            .leftJoinAndMapOne(
                'user.userPremium',
                UserWithPremiumEntity,
                'ownPrem',
                'ownPrem.user_id = user.userId',
            );

        this.applySearchFilter(builder, 'user', params.search);
        this.applySorting(builder, 'user', params.sort, params.order, {
            registeredAt: 'registeredAt',
            name: ['firstName', 'lastName'],
            email: 'email'
        });

        builder.skip(params.offset).take(params.limit);

        const users = await builder.getMany();

        return {
            data: users.map(user => this.userMapper.toUserDto(user)),
            error: false,
        };
    }

    async getModerators(
        params: PaginationParams<'joinedAt' | 'name' | 'email'>,
    ): Promise<StandardResponse<ModeratorDto[]>> {
        const builder = this.moderatorRepository.createQueryBuilder('moderator');

        this.applySearchFilter(builder, 'moderator', params.search);
        this.applySorting(builder, 'moderator', params.sort, params.order, {
            joinedAt: 'joinedAt',
            name: ['firstName', 'lastName'],
            email: 'email'
        });

        builder.skip(params.offset).take(params.limit);

        const moderators = await builder.getMany();

        return {
            data: moderators.map(moderator => this.moderatorMapper.toModeratorDto(moderator)),
            error: false,
        };
    }

    private applySearchFilter<T extends ObjectLiteral>(
        builder: SelectQueryBuilder<T>,
        alias: string,
        search: string
    ): void {
        if (search) {
            builder.where(
                new Brackets((qb) => {
                    qb.where(`${alias}.firstName ILIKE :s`, { s: `%${search}%` })
                        .orWhere(`${alias}.lastName ILIKE :s`, { s: `%${search}%` })
                        .orWhere(`${alias}.email ILIKE :s`, { s: `%${search}%` })
                        .orWhere(
                            `concat(${alias}.firstName, ' ', ${alias}.lastName) ILIKE :s`,
                            { s: `%${search}%` },
                        );
                }),
            );
        }
    }

    private applySorting<T extends ObjectLiteral, TSort extends string>(
        builder: SelectQueryBuilder<T>,
        alias: string,
        sort: TSort,
        order: 'asc' | 'desc',
        sortFieldMap: Record<string, string | string[]>
    ): void {
        const upperOrder = order.toUpperCase() as 'ASC' | 'DESC';
        const field = sortFieldMap[sort];

        if (Array.isArray(field)) {
            builder.orderBy(`${alias}.${field[0]}`, upperOrder);
            for (let i = 1; i < field.length; i++) {
                builder.addOrderBy(`${alias}.${field[i]}`, upperOrder);
            }
        } else if (field) {
            builder.orderBy(`${alias}.${field}`, upperOrder);
        }
    }

    async deleteUser(userId: number): Promise<StandardResponse<void>> {
        const user = await this.userRepository.findOne({
            where: { userId }
        });
        if (!user) {
            throw new NotFoundException("User not found");
        }
        await this.userRepository.softRemove(user);

        return {
            error: false,
        }
    }

    async deleteModerator(moderatorId: number): Promise<StandardResponse<void>> {
        const moderator = await this.moderatorRepository.findOne({
            where: { moderatorId }
        });
        if (!moderator) {
            throw new NotFoundException("Moderator not found");
        }
        await this.chatRepository.update(
            { assignedModerator: { moderatorId }, isActive: true },
            { assignedModerator: null }
        )
        await this.moderatorRepository.softRemove(moderator);

        return {
            error: false,
        }
    }

    async invite(inviteDto: InviteDto, roleType: 'user' | 'moderator' = 'user'): Promise<StandardResponse<void>> {
        if (roleType === 'user') {
            const existingUser = await this.userRepository.findOne({
                where: { email: inviteDto.email },
            });

            if (existingUser) {
                throw new ConflictException(
                    'User with this email already exists',
                );
            }
        } else {
            const existingModerator = await this.moderatorRepository.findOne({
                where: { email: inviteDto.email },
            });

            if (existingModerator) {
                throw new ConflictException(
                    'Moderator with this email already exists',
                );
            }
        }

        const temporaryPassword = this.generateTemporaryPassword();
        const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

        if (roleType === 'user') {
            const user = this.userRepository.create({
                firstName: inviteDto.first_name,
                lastName: inviteDto.last_name,
                email: inviteDto.email,
                password: hashedPassword,
                isTemporaryPassword: true,
            });
            await this.userRepository.save(user);
        } else {
            const moderator = this.moderatorRepository.create({
                firstName: inviteDto.first_name,
                lastName: inviteDto.last_name,
                email: inviteDto.email,
                password: hashedPassword,
                isTemporaryPassword: true,
            });
            await this.moderatorRepository.save(moderator);
        }

        const loginLink = `${process.env.FRONTEND_URL}/${roleType === 'moderator' ? 'moderator/' : ''}login`;
        const roleName = roleType === 'user' ? 'користувача' : 'модератора';

        const html = `
            <html>
                <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px;">
                    <div style="max-width: 600px; margin: auto; background: white; padding: 20px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                        <h1 style="color: #333;">Запрошення до ScriptGlance</h1>
                        <p style="font-size: 16px; color: #555;">
                            Вітаю, ${inviteDto.first_name} ${inviteDto.last_name}!
                        </p>
                        <p style="font-size: 16px; color: #555;">
                            Вас було запрошено приєднатися до платформи <strong>ScriptGlance</strong> як ${roleName}.
                            Для першого входу скористайтеся такими даними:
                        </p>
                        <ul style="font-size: 16px; color: #555;">
                            <li><strong>Email:</strong> ${inviteDto.email}</li>
                            <li><strong>Тимчасовий пароль:</strong> ${temporaryPassword}</li>
                        </ul>
                        <div style="text-align: center; margin-top: 20px;">
                            <a href="${loginLink}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; font-size: 16px;">
                                Увійти до ScriptGlance
                            </a>
                        </div>
                        <p style="font-size: 14px; color: #999; margin-top: 20px;">
                            Якщо ви не очікували цього запрошення, просто проігноруйте цей лист.
                        </p>
                        <p style="font-size: 14px; color: #999;">
                            З найкращими побажаннями,<br/>Команда ScriptGlance
                        </p>
                    </div>
                </body>
            </html>
        `;

        await this.emailService.sendEmail(
            inviteDto.email,
            `Запрошення до ScriptGlance як ${roleName}`,
            html,
        );

        return { error: false };
    }

    async inviteUser(inviteDto: InviteDto): Promise<StandardResponse<void>> {
        return this.invite(inviteDto, 'user');
    }

    async inviteModerator(inviteDto: InviteDto): Promise<StandardResponse<void>> {
        return this.invite(inviteDto, 'moderator');
    }
    private generateTemporaryPassword() {
        return randomBytes(6).toString('hex');
    }

    private async getStatistics(
        limit: number,
        offset: number,
        periodType: 'daily' | 'monthly' = 'daily'
    ): Promise<StandardResponse<StatisticsItemDto[]>> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (periodType === 'monthly') {
            today.setDate(1);
        }

        const periods: Date[] = [];
        for (let i = offset; i < offset + limit; i++) {
            const d = new Date(today);
            if (periodType === 'daily') {
                d.setDate(d.getDate() - i);
            } else {
                d.setMonth(d.getMonth() - i);
            }
            periods.push(d);
        }

        const dateTruncUnit = periodType === 'daily' ? 'day' : 'month';

        const usersRaw = await this.userRepository
            .createQueryBuilder('u')
            .select(`date_trunc('${dateTruncUnit}', u.registeredAt)`, 'period')
            .addSelect('COUNT(*)', 'count')
            .where('u.deletedAt IS NULL')
            .groupBy('period')
            .orderBy('period', 'ASC')
            .getRawMany<{ period: Date; count: string }>();

        const presentationsRaw = await this.presentationStartRepository
            .createQueryBuilder('ps')
            .select(`date_trunc('${dateTruncUnit}', ps.startDate)`, 'period')
            .addSelect(
                `SUM(EXTRACT(EPOCH FROM (ps.endDate - ps.startDate)))`,
                'seconds',
            )
            .where('ps.endDate IS NOT NULL')
            .groupBy('period')
            .getRawMany<{ period: Date; seconds: string }>();

        const presMap = new Map<string, number>();
        presentationsRaw.forEach(({ period, seconds }) => {
            presMap.set(period.toISOString(), parseFloat(seconds));
        });

        const videosRaw = await this.videoRepository
            .createQueryBuilder('v')
            .select(`date_trunc('${dateTruncUnit}', v.recordingStartDate)`, 'period')
            .addSelect('COUNT(*)', 'count')
            .groupBy('period')
            .getRawMany<{ period: Date; count: string }>();

        const videosMap = new Map<string, number>();
        videosRaw.forEach(({ period, count }) => {
            videosMap.set(period.toISOString(), parseInt(count, 10));
        });

        const data: StatisticsItemDto[] = periods.map(periodStart => {
            const totalUsers = usersRaw
                .filter(({ period: registrationPeriod }) => registrationPeriod <= periodStart)
                .reduce((sum, { count }) => sum + parseInt(count, 10), 0);

            return {
                period_start: periodStart,
                total_users_count: totalUsers,
                total_presentation_duration_seconds: Math.round(presMap.get(periodStart.toISOString()) ?? 0),
                videos_recorded_count: videosMap.get(periodStart.toISOString()) ?? 0,
            };
        });

        return {
            data,
            error: false,
        };
    }

    async getDailyStatistics(
        limit: number,
        offset: number,
    ): Promise<StandardResponse<StatisticsItemDto[]>> {
        return this.getStatistics(limit, offset, 'daily');
    }

    async getMonthlyStatistics(
        limit: number,
        offset: number,
    ): Promise<StandardResponse<StatisticsItemDto[]>> {
        return this.getStatistics(limit, offset, 'monthly');
    }
}