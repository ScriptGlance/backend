import {Injectable, InternalServerErrorException, NotFoundException} from '@nestjs/common';
import { StandardResponse } from '../common/interface/StandardResponse';
import {InjectRepository} from "@nestjs/typeorm";
import {Repository} from "typeorm";
import { promises as fs } from 'fs';
import {join} from "path";
import {ModeratorDto} from "./dto/ModeratorDto";
import {ModeratorEntity} from "../common/entities/ModeratorEntity";
import {ModeratorMapper} from "./moderator.mapper";
import * as bcrypt from 'bcryptjs';


@Injectable()
export class ModeratorService {

    constructor(
        @InjectRepository(ModeratorEntity)
        private readonly moderatorRepository: Repository<ModeratorEntity>,
        private readonly moderatorMapper: ModeratorMapper,
    ) {
    }

    async getProfile(moderatorId: number): Promise<StandardResponse<ModeratorDto>> {
        const moderator = await this.moderatorRepository.findOne({
            where: { moderatorId }
        });

        return {
            data: this.moderatorMapper.toModeratorDto(moderator!),
            error: false,
        }
    }

    async changeProfile(
        moderatorId: number,
        firstName: string,
        lastName: string,
        avatar: Express.Multer.File | null,
        password: string = '',
    ): Promise<StandardResponse<ModeratorDto>> {
        const moderator = await this.moderatorRepository.findOne({ where: { moderatorId } });
        if (!moderator) {
            throw new NotFoundException(`Moderator #${moderatorId} not found`);
        }

        if (firstName) {
            moderator.firstName = firstName;
        }
        if (lastName) {
            moderator.lastName = lastName;
        }
        if (password) {
            moderator.password = await bcrypt.hash(password, 10);
        }

        if (avatar) {
            if (moderator.avatar) {
                const oldPath = join(
                    process.cwd(),
                    moderator.avatar,
                );
                try {
                    await fs.unlink(oldPath);
                } catch (err) {
                    if (err.code !== 'ENOENT') {
                        throw new InternalServerErrorException('Failed to remove old avatar');
                    }
                }
            }
            moderator.avatar = avatar.path;
        }

        const updated = await this.moderatorRepository.save(moderator);
        return {
            data: this.moderatorMapper.toModeratorDto(updated),
            error: false,
        };
    }
}
