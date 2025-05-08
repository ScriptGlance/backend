import {
    ForbiddenException, HttpException, HttpStatus,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {LessThanOrEqual, MoreThanOrEqual, Repository} from 'typeorm';

import {PresentationEntity} from '../common/entities/PresentationEntity';
import {ParticipantEntity} from '../common/entities/ParticipantEntity';
import {InvitationEntity} from '../common/entities/InvitationEntity';
import {
    DEFAULT_PRESENTATION_NAME,
    DEFAULT_PRESENTATION_PART_NAME,
} from '../common/Constants';

import {UpdatePresentationDto} from './dto/UpdatePresentationDto';
import {ParticipantDto} from './dto/ParticipantDto';
import {PresentationDto} from './dto/PresentationDto';
import {PresentationStatsResponseDto} from './dto/PresentationStatsResponseDto';
import {StandardResponse} from '../common/interface/StandardResponse';
import {randomBytes} from 'crypto';
import {ColorService} from './color.service';
import {UserWithPremiumEntity} from '../common/entities/UserWithPremiumEntity';
import {PresentationMapper} from './presentations.mapper';
import {InvitationDto} from './dto/InvitationDto';
import {PresentationGateway} from './presentations.gateway';
import {PresentationEventType} from '../common/enum/PresentationEventType';
import {StructureResponseDto} from './dto/StructureResponseDto';
import {PresentationPartEntity} from '../common/entities/PresentationPartEntity';
import {PartDto} from './dto/PartDto';
import {PartCreateDto} from './dto/PartCreateDto';
import {PartUpdateDto} from './dto/PartUpdateDto';
import {CursorPositionDto} from './dto/CursorPositionDto';
import {PartsGateway} from './parts.gateway';
import {PartTarget} from '../common/enum/PartTarget';
import {InjectRedis} from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import {StructureItemDto} from './dto/StructureItemDto';
import {PartEventDto} from './dto/PartEventDto';
import {PartEventType} from '../common/enum/PartEventType';
import {VideoEntity} from "../common/entities/VideoEntity";
import {VideoUploadDto} from "./dto/VideoUploadDto";
import {VideoDto} from "./dto/VideoDto";
import {PresentationStartEntity} from "../common/entities/PresentationStartEntity";
import * as ffmpeg from 'fluent-ffmpeg';
import * as path from "node:path";
import * as fsPromises from 'fs/promises';
import * as fs from "node:fs";
import {Request, Response} from "express";


ffmpeg.setFfprobePath('ffprobe');


@Injectable()
export class PresentationsService {
    constructor(
        @InjectRepository(PresentationEntity)
        private readonly presentationRepository: Repository<PresentationEntity>,
        @InjectRepository(ParticipantEntity)
        private readonly participantRepository: Repository<ParticipantEntity>,
        @InjectRepository(InvitationEntity)
        private readonly invitationRepository: Repository<InvitationEntity>,
        @InjectRepository(PresentationPartEntity)
        private readonly presentationPartRepository: Repository<PresentationPartEntity>,
        private readonly colorService: ColorService,
        private readonly presentationsMapper: PresentationMapper,
        private readonly presentationsGateway: PresentationGateway,
        private readonly partsGateway: PartsGateway,
        @InjectRedis()
        private readonly redis: Redis,
        @InjectRepository(VideoEntity)
        private readonly videoRepository: Repository<VideoEntity>,
        @InjectRepository(PresentationStartEntity)
        private readonly presentationStartRepository: Repository<PresentationStartEntity>,
    ) {
    }

    async createPresentation(
        userId: number,
    ): Promise<StandardResponse<PresentationDto>> {
        const presentation = this.presentationRepository.create({
            name: DEFAULT_PRESENTATION_NAME,
        });
        await this.presentationRepository.save(presentation);

        const ownerParticipant = this.participantRepository.create({
            presentation: presentation,
            user: {userId},
            color: await this.colorService.generateNextHexColor(
                presentation.presentationId,
            ),
        });
        await this.participantRepository.save(ownerParticipant);

        presentation.owner = ownerParticipant;
        await this.presentationRepository.save(presentation);

        const initialPart = this.presentationPartRepository.create({
            presentation: presentation,
            order: 0,
            name: DEFAULT_PRESENTATION_PART_NAME,
            text: '',
            assignee: ownerParticipant,
        });
        await this.presentationPartRepository.save(initialPart);

        return {
            data: this.presentationsMapper.toPresentationDto(
                await this.findOneById(presentation.presentationId, userId),
            ),
            error: false,
        };
    }

    async getPresentationStatistics(
        userId: number,
    ): Promise<StandardResponse<PresentationStatsResponseDto>> {
        const presentationCount = await this.presentationRepository.count({
            where: {owner: {userId}},
        });

        const invitedParticipants = await this.participantRepository
            .createQueryBuilder('participant')
            .innerJoin('participant.presentation', 'presentation')
            .innerJoin('presentation.owner', 'owner')
            .innerJoin('participant.user', 'participantUser')
            .where('owner.userId = :userId', {userId})
            .andWhere('participantUser.userId != :userId', {userId})
            .select('participantUser.userId')
            .distinct(true)
            .getCount();
        return {
            data: {
                presentation_count: presentationCount,
                invited_participants: invitedParticipants,
                recordings_made: 0,
            },
            error: false,
        };
    }

    async getPresentations(
        userId: number,
        limit: number,
        offset: number,
    ): Promise<StandardResponse<PresentationDto[]>> {
        const entities = await this.presentationRepository
            .createQueryBuilder('presentation')
            .leftJoinAndSelect('presentation.owner', 'owner')
            .leftJoinAndSelect('owner.user', 'ownerUser')
            .leftJoinAndMapOne(
                'ownerUser.userPremium',
                UserWithPremiumEntity,
                'ownPrem',
                'ownPrem.user_id = ownerUser.user_id',
            )
            .leftJoinAndSelect('presentation.participants', 'participant')
            .leftJoinAndSelect('participant.user', 'participantUser')
            .leftJoinAndMapOne(
                'participantUser.userPremium',
                UserWithPremiumEntity,
                'partPrem',
                'partPrem.user_id = participantUser.user_id',
            )
            .where('ownerUser.user_id = :userId', {userId})
            .orWhere('participantUser.user_id = :userId', {userId})
            .orderBy('presentation.modifiedAt', 'DESC')
            .skip(offset)
            .take(limit)
            .getMany();

        return {
            data: this.presentationsMapper.toPresentationList(entities),
            error: false,
        };
    }

    public async findOneById(
        id: number,
        userId: number,
    ): Promise<PresentationEntity> {
        const presentation = await this.presentationRepository
            .createQueryBuilder('presentation')
            .leftJoinAndSelect('presentation.owner', 'owner')
            .leftJoinAndSelect('owner.user', 'ownerUser')
            .leftJoinAndSelect('presentation.participants', 'participant')
            .leftJoinAndSelect('participant.user', 'participantUser')
            .where('presentation.presentationId = :id', {id})
            .andWhere('participantUser.userId = :userId', {userId})
            .getOne();

        if (!presentation) {
            throw new NotFoundException(
                `Presentation ${id} not found or access denied`,
            );
        }
        return presentation;
    }

    async getPresentation(
        userId: number,
        id: number,
    ): Promise<StandardResponse<PresentationDto>> {
        const presentation = await this.findOneById(id, userId);
        return {
            data: this.presentationsMapper.toPresentationDto(presentation),
            error: false,
        };
    }

    async updatePresentation(
        userId: number,
        id: number,
        dto: UpdatePresentationDto,
    ): Promise<StandardResponse<PresentationDto>> {
        const presentation = await this.findOneById(id, userId);
        if (presentation?.owner.userId !== userId) {
            throw new ForbiddenException(
                `You are not the owner of presentation ${id}`,
            );
        }
        Object.assign(presentation, dto);
        await this.presentationRepository.save(presentation);
        this.presentationsGateway.emitPresentationEvent(
            id,
            PresentationEventType.NameChanged,
        );
        return {
            data: this.presentationsMapper.toPresentationDto(
                await this.findOneById(id, userId),
            ),
            error: false,
        };
    }

    async removePresentation(
        userId: number,
        id: number,
    ): Promise<StandardResponse<any>> {
        const presentation = await this.findOneById(id, userId);
        if (presentation.owner.userId !== userId) {
            throw new ForbiddenException(
                `You are not the owner of presentation ${id}`,
            );
        }
        await this.presentationRepository.softDelete(id);
        return {
            error: false,
        };
    }

    async getParticipants(
        userId: number,
        id: number,
    ): Promise<StandardResponse<ParticipantDto[]>> {
        await this.findOneById(id, userId);
        const participants = await this.participantRepository
            .createQueryBuilder('p')
            .leftJoinAndSelect('p.user', 'u')
            .leftJoinAndMapOne(
                'u.userPremium',
                UserWithPremiumEntity,
                'uwp',
                'uwp.user_id = u.user_id',
            )
            .where('p.presentation_id = :id', {id})
            .getMany();
        return {
            data: participants.map((p) =>
                this.presentationsMapper.toParticipantDto(p),
            ),
            error: false,
        };
    }

    async removeParticipant(
        userId: number,
        id: number,
    ): Promise<StandardResponse<any>> {
        const presentationId = await this.participantRepository
            .createQueryBuilder('participant')
            .leftJoinAndSelect('participant.presentation', 'presentation')
            .where('participant.participantId = :id', {id})
            .getOne()
            .then((p) => p?.presentation.presentationId);

        const presentation = await this.findOneById(presentationId!, userId);
        if (presentation.owner.userId !== userId) {
            throw new ForbiddenException(
                `You are not the owner of presentation ${id}`,
            );
        }
        const participant = await this.participantRepository.findOne({
            where: {participantId: id},
            relations: ['user'],
        });
        if (!participant) {
            throw new NotFoundException(`Participant ${id} not found`);
        }
        if (participant.user.userId === userId) {
            throw new ForbiddenException(
                `You cannot remove yourself from presentation ${id}`,
            );
        }
        await this.participantRepository.remove(participant);
        this.presentationsGateway.emitPresentationEvent(
            presentationId!,
            PresentationEventType.ParticipantsChanged,
        );
        return {
            error: false,
        };
    }

    async inviteParticipant(
        userId: number,
        id: number,
    ): Promise<StandardResponse<InvitationDto>> {
        const presentation = await this.findOneById(id, userId);
        if (presentation.owner.userId !== userId) {
            throw new ForbiddenException(
                `You are not the owner of presentation ${id}`,
            );
        }
        const invitation = this.invitationRepository.create({
            presentation,
            code: this.generateInvitationCode(),
        });
        await this.invitationRepository.save(invitation);
        return {
            data: this.presentationsMapper.toInvitationDto(invitation),
            error: false,
        };
    }

    private generateInvitationCode(): string {
        return randomBytes(16).toString('hex');
    }

    //TODO make invitation invalid after use
    async acceptInvitation(
        userId: number,
        code: string,
    ): Promise<StandardResponse<any>> {
        const invitation = await this.invitationRepository.findOne({
            where: {code},
            relations: ['presentation'],
        });
        if (!invitation) {
            throw new NotFoundException(`Invitation ${code} not found`);
        }

        const existingParticipant = await this.participantRepository.findOne({
            where: {
                presentation: {
                    presentationId: invitation.presentation.presentationId,
                },
                user: {userId},
            },
        });

        if (existingParticipant) {
            throw new ForbiddenException(
                `You are already a participant of presentation ${invitation.presentation.presentationId}`,
            );
        }

        const part = this.participantRepository.create({
            presentation: invitation.presentation,
            user: {userId},
            color: await this.colorService.generateNextHexColor(
                invitation.presentationId,
            ),
        });
        await this.participantRepository.save(part);
        this.presentationsGateway.emitPresentationEvent(
            invitation.presentation.presentationId,
            PresentationEventType.ParticipantsChanged,
        );
        return {
            error: false,
        };
    }

    private async getPresentationPartContent(
        partId: number,
        target: PartTarget,
        fallback: string,
    ): Promise<string> {
        const key = `editing:part:${partId}:${target}`;
        const raw = await this.redis.get(key);
        if (!raw) return fallback;
        try {
            const {content} = JSON.parse(raw) as {
                content: string;
                version: number;
            };
            return content;
        } catch {
            return fallback;
        }
    }

    async getStructure(
        userId: number,
        presentationId: number,
    ): Promise<StandardResponse<StructureResponseDto>> {
        await this.findOneById(presentationId, userId);
        const parts = await this.presentationPartRepository.find({
            where: {presentationId},
            relations: ['assignee', 'assignee.user'],
            order: {order: 'ASC'},
        });

        let totalWords = 0;
        const structure: StructureItemDto[] = [];

        for (const p of parts) {
            const name = await this.getPresentationPartContent(
                p.presentationPartId,
                PartTarget.Name,
                p.name,
            );

            const text = await this.getPresentationPartContent(
                p.presentationPartId,
                PartTarget.Text,
                p.text,
            );

            const words = text
                .trim()
                .split(/\s+/)
                .filter((w) => w.length > 0).length;
            totalWords += words;

            structure.push(
                this.presentationsMapper.toStructureItemDto(
                    {...p, name, text},
                    words,
                ),
            );
        }

        return {
            data: {total_words_count: totalWords, structure},
            error: false,
        };
    }

    async listParts(
        userId: number,
        presentationId: number,
    ): Promise<StandardResponse<PartDto[]>> {
        await this.findOneById(presentationId, userId);
        const parts = await this.presentationPartRepository.find({
            where: {presentationId},
            order: {order: 'ASC'},
        });

        const result: PartDto[] = [];
        for (const p of parts) {
            const name = await this.getPresentationPartContent(
                p.presentationPartId,
                PartTarget.Name,
                p.name,
            );
            const text = await this.getPresentationPartContent(
                p.presentationPartId,
                PartTarget.Text,
                p.text,
            );

            result.push(this.presentationsMapper.toPartDto({...p, name, text}));
        }

        return {data: result, error: false};
    }

    async createPart(
        userId: number,
        presentationId: number,
        data: PartCreateDto,
    ): Promise<StandardResponse<PartDto>> {
        await this.findOneById(presentationId, userId);
        const presentation = await this.findOneById(presentationId, userId);
        const participant = await this.participantRepository.findOneBy({
            user: {userId},
            presentation: {presentationId},
        });
        if (!participant) {
            throw new NotFoundException('Owner participant not found');
        }
        // if (presentation.isActive) { TODO: check if presentation is active
        //   throw new ConflictException('presentation is currently launched');
        // }

        await this.presentationPartRepository
            .createQueryBuilder()
            .update(PresentationPartEntity)
            .set({order: () => `"order" 1`})
            .where('"presentation_id" = :pid AND "order" >= :ord', {
                pid: presentationId,
                ord: data.part_order,
            })
            .execute();

        const part = this.presentationPartRepository.create({
            presentation: presentation,
            order: data.part_order,
            name: DEFAULT_PRESENTATION_PART_NAME,
            text: '',
            assignee: participant,
        });
        await this.presentationPartRepository.save(part);

        this.presentationsGateway.emitPresentationEvent(
            presentationId,
            PresentationEventType.TextChanged,
        );

        this.partsGateway.emitPartEvent(
            presentationId,
            new PartEventDto(
                PartEventType.PartAdded,
                part.presentationPartId,
                part.order,
                participant.participantId,
            ),
        );

        return {
            data: this.presentationsMapper.toPartDto(part),
            error: false,
        };
    }

    async updatePart(
        userId: number,
        partId: number,
        data: PartUpdateDto,
    ): Promise<StandardResponse<PartDto>> {
        const part = await this.presentationPartRepository.findOne({
            where: {presentationPartId: partId},
            relations: ['presentation'],
        });
        if (!part) {
            throw new NotFoundException(`Part ${partId} not found`);
        }
        await this.findOneById(part.presentation.presentationId, userId);
        // if (part.presentation.isActive) { TODO: check if presentation is active
        //   throw new ConflictException(
        //     'cannot update part while presentation active',
        //   );
        // }

        if (data.part_order !== undefined && data.part_order !== part.order) {
            const oldOrder = part.order;
            const newOrder = data.part_order;
            const presentationId = part.presentation.presentationId;

            if (newOrder < oldOrder) {
                await this.presentationPartRepository
                    .createQueryBuilder()
                    .update(PresentationPartEntity)
                    .set({order: () => `"order" 1`})
                    .where(
                        `"presentation_id" = :pid AND "order" >= :newOrd AND "order" < :oldOrd`,
                        {pid: presentationId, newOrd: newOrder, oldOrd: oldOrder},
                    )
                    .execute();
            } else {
                await this.presentationPartRepository
                    .createQueryBuilder()
                    .update(PresentationPartEntity)
                    .set({order: () => `"order" - 1`})
                    .where(
                        `"presentation_id" = :pid AND "order" > :oldOrd AND "order" <= :newOrd`,
                        {pid: presentationId, oldOrd: oldOrder, newOrd: newOrder},
                    )
                    .execute();
            }
            part.order = newOrder;
        }

        if (data.part_assignee_participant_id !== undefined) {
            part.assigneeParticipantId = data.part_assignee_participant_id;
        }

        await this.presentationPartRepository.save(part);

        this.presentationsGateway.emitPresentationEvent(
            part.presentation.presentationId,
            PresentationEventType.TextChanged,
        );

        this.partsGateway.emitPartEvent(
            part.presentation.presentationId,
            new PartEventDto(
                PartEventType.PartUpdated,
                part.presentationPartId,
                part.order,
                part.assigneeParticipantId,
            ),
        );

        return {
            data: this.presentationsMapper.toPartDto(part),
            error: false,
        };
    }

    async deletePart(
        userId: number,
        partId: number,
    ): Promise<StandardResponse<any>> {
        const part = await this.presentationPartRepository.findOne({
            where: {presentationPartId: partId},
            relations: ['presentation'],
        });
        if (!part) {
            throw new NotFoundException(`Part ${partId} not found`);
        }
        await this.findOneById(part.presentation.presentationId, userId);
        // if (part.presentation.isActive) { TODO: check if presentation is active
        //   throw new ConflictException(
        //     'cannot delete part while presentation active',
        //   );
        // }

        const presentationId = part.presentation.presentationId;
        const oldOrder = part.order;

        await this.presentationPartRepository.remove(part);

        await this.presentationPartRepository
            .createQueryBuilder()
            .update(PresentationPartEntity)
            .set({order: () => `"order" - 1`})
            .where(`"presentation_id" = :pid AND "order" > :oldOrd`, {
                pid: presentationId,
                oldOrd: oldOrder,
            })
            .execute();

        this.presentationsGateway.emitPresentationEvent(
            presentationId,
            PresentationEventType.TextChanged,
        );

        this.partsGateway.emitPartEvent(
            presentationId,
            new PartEventDto(PartEventType.PartRemoved, partId),
        );
        return {
            error: false,
        };
    }

    async getPresentationCursorPositions(
        userId: number,
        presentationId: number,
    ): Promise<StandardResponse<CursorPositionDto[]>> {
        await this.findOneById(presentationId, userId);
        const positions =
            this.partsGateway.getCursorPositionsForPresentation(presentationId);
        return {
            data: positions,
            error: false,
        };
    }

    private probeDurationMs(path: string): Promise<number> {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(path, (err, metadata) => {
                if (err) {
                    return reject(err);
                }
                const ms = Math.round((metadata.format.duration ?? 0) * 1000);
                resolve(ms);
            });
        });
    }

    private async generateThumbnail(videoPath: string): Promise<string> {
        const previewsDir = './uploads/previews';
        await fsPromises.mkdir(previewsDir, {recursive: true});

        const baseName = path.basename(videoPath, path.extname(videoPath));
        const fileName = `${baseName}.png`;
        const outputPath = path.join(previewsDir, fileName);

        try {
            await fsPromises.access(outputPath);
            return outputPath;
        } catch {
        }

        return new Promise((resolve, reject) => {
            ffmpeg(videoPath)
                .screenshots({
                    count: 1,
                    timemarks: ['0'],
                    folder: previewsDir,
                    filename: fileName,
                    size: '320x?',
                })
                .on('end', () => resolve(outputPath))
                .on('error', reject);
        });
    }

    private generatePresentationShareCode(): string {
        return randomBytes(16).toString('hex');
    }

    //TODO check the video watermark
    async uploadPresentationVideo(
        presentationId: number,
        userId: number,
        file: Express.Multer.File,
        dto: VideoUploadDto,
    ): Promise<StandardResponse<VideoDto>> {
        const presentation = await this.findOneById(presentationId, userId);
        if (!presentation) {
            throw new NotFoundException('Presentation not found');
        }
        const recordingStart = new Date(dto.startTimestamp);
        console.log(recordingStart)
        const presentationStart = await this.presentationStartRepository
            .createQueryBuilder('ps')
            .innerJoin('ps.presentation', 'p')
            .where('p.presentation_id = :pid', {
                pid: presentation.presentationId,
            })
            .andWhere('ps.start_date <= :ts', {ts: recordingStart})
            .andWhere('ps.end_date   >= :ts', {ts: recordingStart})
            .getOne();
        if (!presentationStart) {
            throw new NotFoundException(
                'No presentation start matching given timestamp',
            );
        }
        const title = `Частина ${dto.partOrder} - ${dto.partName}`;
        const durationMs = await this.probeDurationMs(file.path);
        const thumbnail = await this.generateThumbnail(file.path);
        const shareCode = this.generatePresentationShareCode();
        const video = this.videoRepository.create({
            presentationStart,
            link: file.path,
            title,
            duration: durationMs,
            photoPreviewLink: thumbnail,
            shareCode,
            recordingStartDate: recordingStart,
            user: presentation.participants[0].user
        });
        await this.videoRepository.save(video);
        this.presentationsGateway.emitPresentationEvent(
            presentationId,
            PresentationEventType.VideosChanged,
        );
        return {
            error: false,
            data: this.presentationsMapper.toVideoDto(video),
        };
    }

    async streamPresentationVideo(
        videoId: number,
        userId: number,
        req: Request,
        res: Response,
    ): Promise<void> {
        const video = await this.videoRepository.findOne({
            where: {videoId},
            relations: ['user', 'presentationStart.presentation'],
        });
        if (!video) throw new NotFoundException('Video not found');

        const presentation = await this.findOneById(video.presentationStart.presentation.presentationId, userId);

        const isOwner = presentation.owner.user.userId === userId;
        const isUploader = video.user.userId === userId;
        if (!isOwner && !isUploader) {
            throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
        }

        const fileName = path.basename(video.link);
        const filePath = path.join(process.cwd(), 'uploads', 'videos', fileName);
        if (!fs.existsSync(filePath)) {
            throw new HttpException('Not Found', HttpStatus.NOT_FOUND);
        }

        const stat = fs.statSync(filePath);
        const fileSize = stat.size;
        const range = req.headers['range'] as string | undefined;

        if (range) {
            const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
            const start = parseInt(startStr, 10);
            const end = endStr ? parseInt(endStr, 10) : fileSize - 1;
            const chunkSize = end - start + 1;

            res
                .status(HttpStatus.PARTIAL_CONTENT)
                .set({
                    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunkSize,
                    'Content-Type': 'video/webm',
                });

            fs.createReadStream(filePath, {start, end}).pipe(res);
        } else {
            res
                .status(HttpStatus.OK)
                .set({
                    'Content-Length': fileSize,
                    'Content-Type': 'video/webm',
                });

            fs.createReadStream(filePath).pipe(res);
        }
    }

    async getVideoShareCode(videoId: number, userId: number): Promise<StandardResponse<{ shareCode: string }>> {
        const video = await this.videoRepository.findOne({
            where: {videoId},
            relations: ['user', 'presentationStart', 'presentationStart.presentation', 'presentationStart.presentation.owner.user'],
        });
        if (!video) throw new NotFoundException('Video not found');

        const ownerId = video.presentationStart.presentation.owner.user.userId;
        const uploaderId = video.user.userId;
        if (userId !== ownerId && userId !== uploaderId) {
            throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
        }

        return {
            data: {
                shareCode: video.shareCode
            }, error: false
        };
    }

    async removeVideo(
        videoId: number,
        userId: number,
    ): Promise<void> {
        const video = await this.videoRepository.findOne({
            where: {videoId},
            relations: [
                'user',
                'presentationStart',
                'presentationStart.presentation',
                'presentationStart.presentation.owner',
                'presentationStart.presentation.owner.user',
            ],
        });
        if (!video) {
            throw new NotFoundException('Video not found');
        }

        const presentation = video.presentationStart.presentation;

        const isOwner = presentation.owner.user.userId === userId;
        const isUploader = video.user.userId === userId;
        if (!isOwner && !isUploader) {
            throw new ForbiddenException('You are not allowed to delete this video');
        }

        const videoFsPath = path.join(process.cwd(), video.link);
        const previewFsPath = path.join(process.cwd(), video.photoPreviewLink);

        await fsPromises.unlink(videoFsPath).catch(() => {
        });
        await fsPromises.unlink(previewFsPath).catch(() => {
        });

        await this.videoRepository.softDelete(videoId);
        this.presentationsGateway.emitPresentationEvent(
            presentation.presentationId,
            PresentationEventType.VideosChanged,
        );
    }

    async getPresentationVideos(
        presentationId: number,
        userId: number,
    ): Promise<StandardResponse<VideoDto[]>> {
        const presentation = await this.presentationRepository.findOne({
            where: {presentationId},
            relations: ['owner', 'owner.user'],
        });
        if (!presentation) {
            throw new NotFoundException('Presentation not found');
        }

        const isOwner = presentation.owner.user.userId === userId;
        const queryBuilder = this.videoRepository
            .createQueryBuilder('video')
            .innerJoin('video.presentationStart', 'ps')
            .innerJoin('ps.presentation', 'p', 'p.presentationId = :pid', { pid: presentationId })
            .innerJoinAndSelect('video.user', 'u');

        if (!isOwner) {
            queryBuilder.andWhere('u.userId = :uid', { uid: userId });
        }

        const videos = await queryBuilder.getMany();
        const data = videos.map((v) =>
            this.presentationsMapper.toVideoDto(v),
        );

        return {
            error: false,
            data,
        };
    }
}
