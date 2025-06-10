import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';

import { PresentationEntity } from '../common/entities/PresentationEntity';
import { ParticipantEntity } from '../common/entities/ParticipantEntity';
import { InvitationEntity } from '../common/entities/InvitationEntity';
import { UserInvitationEntity } from '../common/entities/UserInvitationEntity';
import {
  DEFAULT_PRESENTATION_NAME,
  DEFAULT_PRESENTATION_PART_NAME,
  FREE_VIDEOS_PER_PRESENTATION,
  MAX_FREE_PARTICIPANTS_COUNT,
  MAX_FREE_RECORDING_TIME_SECONDS,
  VIDEO_DURATION_MAX_TAIL_SECONDS,
} from '../common/Constants';

import { UpdatePresentationDto } from './dto/UpdatePresentationDto';
import { ParticipantDto } from './dto/ParticipantDto';
import { PresentationDto } from './dto/PresentationDto';
import { PresentationStatsResponseDto } from './dto/PresentationStatsResponseDto';
import { StandardResponse } from '../common/interface/StandardResponse';
import { randomBytes } from 'crypto';
import { ColorService } from './color.service';
import { UserWithPremiumEntity } from '../common/entities/UserWithPremiumEntity';
import { PresentationMapper } from './presentations.mapper';
import { InvitationDto } from './dto/InvitationDto';
import { PresentationsGateway } from './presentations.gateway';
import { PresentationEventType } from '../common/enum/PresentationEventType';
import { StructureResponseDto } from './dto/StructureResponseDto';
import { PresentationPartEntity } from '../common/entities/PresentationPartEntity';
import { PartDto } from './dto/PartDto';
import { PartCreateDto } from './dto/PartCreateDto';
import { PartUpdateDto } from './dto/PartUpdateDto';
import { CursorPositionDto } from './dto/CursorPositionDto';
import { PartsGateway } from './parts.gateway';
import { PartTarget } from '../common/enum/PartTarget';
import { StructureItemDto } from './dto/StructureItemDto';
import { PartEventDto } from './dto/PartEventDto';
import { PartEventType } from '../common/enum/PartEventType';
import { VideoEntity } from '../common/entities/VideoEntity';
import { VideoUploadDto } from './dto/VideoUploadDto';
import { VideoDto } from './dto/VideoDto';
import { PresentationStartEntity } from '../common/entities/PresentationStartEntity';
import * as ffmpeg from 'fluent-ffmpeg';
import * as path from 'node:path';
import * as fsPromises from 'fs/promises';
import * as fs from 'node:fs';
import { Request, Response } from 'express';
import { ActivePresentationWithUsersDto } from './dto/ActivePresentationWithUsersDto';
import { TeleprompterGateway } from './teleprompter.gateway';
import { UserEntity } from '../common/entities/UserEntity';
import { VideosLeftDto } from './dto/VideosLeftDto';
import { AcceptInvitationDto } from './dto/AcceptInvitationDto';
import { PresentationPartContentService } from './presentation-part-content.service';
import { StartVideoRecordingDto } from './dto/StartVideoRecordingDto';

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
    @InjectRepository(UserInvitationEntity)
    private readonly userInvitationRepository: Repository<UserInvitationEntity>,
    @InjectRepository(PresentationPartEntity)
    private readonly presentationPartRepository: Repository<PresentationPartEntity>,
    private readonly colorService: ColorService,
    private readonly presentationsMapper: PresentationMapper,
    private readonly presentationsGateway: PresentationsGateway,
    private readonly partsGateway: PartsGateway,
    private readonly presentationPartContentService: PresentationPartContentService,
    @InjectRepository(VideoEntity)
    private readonly videoRepository: Repository<VideoEntity>,
    @InjectRepository(PresentationStartEntity)
    private readonly presentationStartRepository: Repository<PresentationStartEntity>,
    private readonly teleprompterGateway: TeleprompterGateway,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(UserWithPremiumEntity)
    private readonly userWithPremiumRepository: Repository<UserWithPremiumEntity>,
  ) {}

  async createPresentation(
    userId: number,
  ): Promise<StandardResponse<PresentationDto>> {
    const presentation = this.presentationRepository.create({
      name: DEFAULT_PRESENTATION_NAME,
    });
    await this.presentationRepository.save(presentation);

    const ownerParticipant = this.participantRepository.create({
      presentation: presentation,
      user: { userId },
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
      where: { participants: { user: { userId } } },
      relations: ['participants'],
    });

    const invitedParticipants = await this.participantRepository
      .createQueryBuilder('participant')
      .innerJoin('participant.presentation', 'presentation')
      .innerJoin('presentation.owner', 'owner')
      .innerJoin('participant.user', 'participantUser')
      .where('owner.userId = :userId', { userId })
      .andWhere('participantUser.userId != :userId', { userId })
      .select('participantUser.userId')
      .distinct(true)
      .getCount();

    const recordingsMade = await this.videoRepository
      .createQueryBuilder('video')
      .innerJoin('video.presentationStart', 'ps')
      .innerJoin('ps.presentation', 'p')
      .innerJoin('p.participants', 'participant')
      .innerJoin('participant.user', 'participantUser')
      .where('video.userUserId = :userId', { userId })
      .andWhere('participantUser.userId = :userId', { userId })
      .getCount();

    return {
      data: {
        presentation_count: presentationCount,
        invited_participants: invitedParticipants,
        recordings_made: recordingsMade,
      },
      error: false,
    };
  }

  async getPresentations(
    userId: number,
    limit: number,
    offset: number,
    search: string,
    sort: 'byUpdatedAt' | 'byName' | 'byCreatedAt' | 'byParticipantsCount',
    owner: 'me' | 'others' | 'all',
    lastChange: 'today' | 'lastWeek' | 'lastMonth' | 'lastYear' | 'allTime',
    type: 'individual' | 'group' | 'all',
  ): Promise<StandardResponse<PresentationDto[]>> {
    const query = this.presentationRepository
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
      .addSelect(
        `(SELECT COUNT(p.participant_id) FROM participant p WHERE p.presentation_id = presentation.presentation_id)`,
        'participant_count',
      );

    if (owner === 'me') {
      query.andWhere('ownerUser.user_id = :userId', { userId });
    } else if (owner === 'others') {
      query
        .andWhere('ownerUser.user_id != :userId', { userId })
        .andWhere('participantUser.user_id = :userId', { userId });
    } else {
      query.andWhere(
        '(ownerUser.user_id = :userId OR participantUser.user_id = :userId)',
        { userId },
      );
    }

    if (search && search.trim()) {
      query.andWhere('presentation.name ILIKE :search', {
        search: `%${search.trim()}%`,
      });
    }

    const now = new Date();
    if (lastChange === 'today') {
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      query.andWhere('presentation.modifiedAt >= :startDate', {
        startDate: todayStart,
      });
    } else if (lastChange === 'lastWeek') {
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 7);
      query.andWhere('presentation.modifiedAt >= :startDate', {
        startDate: weekAgo,
      });
    } else if (lastChange === 'lastMonth') {
      const monthAgo = new Date(now);
      monthAgo.setMonth(now.getMonth() - 1);
      query.andWhere('presentation.modifiedAt >= :startDate', {
        startDate: monthAgo,
      });
    } else if (lastChange === 'lastYear') {
      const yearAgo = new Date(now);
      yearAgo.setFullYear(now.getFullYear() - 1);
      query.andWhere('presentation.modifiedAt >= :startDate', {
        startDate: yearAgo,
      });
    }

    if (type === 'individual') {
      query.andWhere((qb) => {
        const subQuery = qb
          .subQuery()
          .select('COUNT(p.participant_id)')
          .from(ParticipantEntity, 'p')
          .where('p.presentation_id = presentation.presentation_id')
          .getQuery();
        return `${subQuery} = 1`;
      });
    } else if (type === 'group') {
      query.andWhere((qb) => {
        const subQuery = qb
          .subQuery()
          .select('COUNT(p.participant_id)')
          .from(ParticipantEntity, 'p')
          .where('p.presentation_id = presentation.presentation_id')
          .getQuery();
        return `${subQuery} > 1`;
      });
    }

    switch (sort) {
      case 'byName':
        query.orderBy('presentation.name', 'ASC');
        break;
      case 'byCreatedAt':
        query.orderBy('presentation.createdAt', 'DESC');
        break;
      case 'byParticipantsCount':
        query.orderBy('participant_count', 'DESC');
        break;
      case 'byUpdatedAt':
      default:
        query.orderBy('presentation.modifiedAt', 'DESC');
        break;
    }

    query.skip(offset).take(limit);

    const entities = await query.getMany();

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
      .where('presentation.presentationId = :id', { id })
      .andWhere('participantUser.userId = :userId', { userId })
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

    if (!dto.name) {
      throw new BadRequestException('Presentation name is required');
    }

    await this.presentationRepository.update(
      {
        presentationId: id,
      },
      {
        name: dto.name,
      },
    );
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

    await this.presentationRepository.manager.transaction(async (manager) => {
      await manager
        .createQueryBuilder()
        .delete()
        .from(PresentationPartEntity)
        .where('presentationId = :id', { id: presentation.presentationId })
        .execute();

      await manager
        .createQueryBuilder()
        .update(PresentationEntity)
        .set({ ownerParticipantId: null })
        .where('presentationId = :id', { id: presentation.presentationId })
        .execute();

      await manager
        .createQueryBuilder()
        .delete()
        .from(ParticipantEntity)
        .where('presentationId = :id', { id: presentation.presentationId })
        .execute();

      await manager.getRepository(PresentationEntity).softRemove(presentation);
    });

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
      .where('p.presentation_id = :id', { id })
      .andWhere('u.deleted_at IS NULL')
      .getMany();
    return {
      data: participants
        .filter((p) => p.user)
        .map((p) => this.presentationsMapper.toParticipantDto(p)),
      error: false,
    };
  }

  async removeParticipant(
    userId: number,
    id: number,
  ): Promise<StandardResponse<any>> {
    const participant = await this.participantRepository.findOne({
      where: { participantId: id },
      relations: ['user', 'presentation'],
    });

    if (!participant) {
      throw new NotFoundException(`Participant ${id} not found`);
    }

    const presentationId = participant.presentation!.presentationId;
    const presentation = await this.findOneById(presentationId, userId);

    if (presentation.owner.userId !== userId) {
      throw new ForbiddenException(
        `You are not the owner of presentation ${presentationId}`,
      );
    }

    if (participant.user.userId === userId) {
      throw new ForbiddenException(
        `You cannot remove yourself from presentation ${presentationId}`,
      );
    }

    await this.presentationPartRepository.update(
      {
        presentationId: presentationId,
        assigneeParticipantId: participant.participantId,
      },
      {
        assigneeParticipantId: presentation.owner.participantId,
      },
    );

    await this.participantRepository.remove(participant);

    this.presentationsGateway.emitPresentationEvent(
      presentationId,
      PresentationEventType.ParticipantsChanged,
    );
    this.presentationsGateway.emitPresentationEvent(
      presentationId,
      PresentationEventType.TextChanged,
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

  async acceptInvitation(
    userId: number,
    code: string,
  ): Promise<StandardResponse<AcceptInvitationDto>> {
    const invitation = await this.invitationRepository.findOne({
      where: { code },
      relations: ['presentation', 'presentation.owner'],
    });
    if (!invitation) {
      throw new NotFoundException(`Invitation ${code} not found`);
    }

    const userInvitation = await this.userInvitationRepository.findOne({
      where: {
        userId,
        invitationId: invitation.invitationId,
      },
    });

    if (userInvitation) {
      throw new ForbiddenException(
        `You have already used this invitation or were removed from this presentation`,
      );
    }

    const existingParticipant = await this.participantRepository.findOne({
      where: {
        presentation: {
          presentationId: invitation.presentation.presentationId,
        },
        user: { userId },
      },
    });

    if (existingParticipant) {
      throw new ForbiddenException(
        `You are already a participant of presentation ${invitation.presentation.presentationId}`,
      );
    }

    const participantsCount = await this.participantRepository.count({
      where: {
        presentation: {
          presentationId: invitation.presentation.presentationId,
        },
      },
    });

    const owner = await this.userRepository
      .createQueryBuilder('u')
      .leftJoinAndMapOne(
        'u.userPremium',
        UserWithPremiumEntity,
        'prem',
        'prem.user_id = u.user_id',
      )
      .where('u.user_id = :id', { id: invitation.presentation.owner.userId })
      .getOne();
    const ownerHasPremium = owner?.userPremium?.has_premium === true;

    if (!ownerHasPremium && participantsCount >= MAX_FREE_PARTICIPANTS_COUNT) {
      throw new ForbiddenException(
        `Free users can have up to ${MAX_FREE_PARTICIPANTS_COUNT} participants`,
      );
    }

    const participant = this.participantRepository.create({
      presentation: invitation.presentation,
      user: { userId },
      color: await this.colorService.generateNextHexColor(
        invitation.presentationId,
      ),
    });
    await this.participantRepository.save(participant);

    const newUserInvitation = this.userInvitationRepository.create({
      userId,
      invitationId: invitation.invitationId,
    });
    await this.userInvitationRepository.save(newUserInvitation);

    this.presentationsGateway.emitPresentationEvent(
      invitation.presentation.presentationId,
      PresentationEventType.ParticipantsChanged,
    );
    return {
      error: false,
      data: {
        presentation_id: invitation.presentation.presentationId,
      },
    };
  }

  async getStructure(
    userId: number,
    presentationId: number,
  ): Promise<StandardResponse<StructureResponseDto>> {
    await this.findOneById(presentationId, userId);
    const parts = await this.presentationPartRepository.find({
      where: { presentationId },
      relations: ['assignee', 'assignee.user'],
      order: { order: 'ASC' },
    });

    let totalWords = 0;
    const structure: StructureItemDto[] = [];

    for (const p of parts) {
      const name =
        await this.presentationPartContentService.getPresentationPartContent(
          p.presentationPartId,
          PartTarget.Name,
          p.name,
        );

      const text =
        await this.presentationPartContentService.getPresentationPartContent(
          p.presentationPartId,
          PartTarget.Text,
          p.text,
        );

      const words = text.content
        .trim()
        .split(/\s+/)
        .filter((w) => w.length > 0).length;
      totalWords += words;

      structure.push(
        this.presentationsMapper.toStructureItemDto(
          { ...p, name: name.content, text: text.content },
          words,
        ),
      );
    }

    return {
      data: { total_words_count: totalWords, structure },
      error: false,
    };
  }

  async listParts(
    userId: number,
    presentationId: number,
  ): Promise<StandardResponse<PartDto[]>> {
    await this.findOneById(presentationId, userId);
    const parts = await this.presentationPartRepository.find({
      where: { presentationId },
      order: { order: 'ASC' },
    });

    const result: PartDto[] = [];
    for (const p of parts) {
      const name =
        await this.presentationPartContentService.getPresentationPartContent(
          p.presentationPartId,
          PartTarget.Name,
          p.name,
        );
      const text =
        await this.presentationPartContentService.getPresentationPartContent(
          p.presentationPartId,
          PartTarget.Text,
          p.text,
        );

      result.push(
        this.presentationsMapper.toPartDto(
          {
            ...p,
            name: name.content,
            text: text.content,
          },
          text.version,
          name.version,
        ),
      );
    }

    return { data: result, error: false };
  }

  async createPart(
    userId: number,
    presentationId: number,
    data: PartCreateDto,
  ): Promise<StandardResponse<PartDto>> {
    await this.findOneById(presentationId, userId);
    const presentation = await this.findOneById(presentationId, userId);
    const participant = await this.participantRepository.findOneBy({
      user: { userId },
      presentation: { presentationId },
    });
    if (!participant) {
      throw new NotFoundException('Owner participant not found');
    }
    if (await this.getPresentationStart(presentationId)) {
      throw new ConflictException('presentation is currently launched');
    }

    await this.presentationPartRepository
      .createQueryBuilder()
      .update(PresentationPartEntity)
      .set({ order: () => `"order" + 1` })
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
      where: { presentationPartId: partId },
      relations: ['presentation'],
    });
    if (!part) {
      throw new NotFoundException(`Part ${partId} not found`);
    }
    await this.findOneById(part.presentationId, userId);
    if (await this.getPresentationStart(part.presentationId)) {
      throw new ConflictException(
        'cannot update part while presentation active',
      );
    }

    if (data.part_order !== undefined && data.part_order !== part.order) {
      const oldOrder = part.order;
      const newOrder = data.part_order;
      const presentationId = part.presentation.presentationId;
      if (newOrder < oldOrder) {
        await this.presentationPartRepository
          .createQueryBuilder()
          .update(PresentationPartEntity)
          .set({ order: () => `"order" + 1` })
          .where(
            `"presentation_id" = :pid AND "order" >= :newOrd AND "order" < :oldOrd`,
            { pid: presentationId, newOrd: newOrder, oldOrd: oldOrder },
          )
          .execute();
      } else {
        await this.presentationPartRepository
          .createQueryBuilder()
          .update(PresentationPartEntity)
          .set({ order: () => `"order" - 1` })
          .where(
            `"presentation_id" = :pid AND "order" > :oldOrd AND "order" <= :newOrd`,
            { pid: presentationId, oldOrd: oldOrder, newOrd: newOrder },
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
        part.assigneeParticipantId ?? undefined,
      ),
    );

    if (data.part_assignee_participant_id !== undefined) {
      const participant = await this.participantRepository.findOne({
        where: { participantId: data.part_assignee_participant_id },
        select: ['userId'],
      });
      if (participant) {
        await this.teleprompterGateway.updatePartAssignee(
          part.presentationId,
          partId,
          participant.userId,
        );
      }
    }

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
      where: { presentationPartId: partId },
      relations: ['presentation'],
    });
    if (!part) {
      throw new NotFoundException(`Part ${partId} not found`);
    }
    await this.findOneById(part.presentationId, userId);
    if (await this.getPresentationStart(part.presentationId)) {
      throw new ConflictException(
        'cannot delete part while presentation active',
      );
    }

    const presentationId = part.presentation.presentationId;
    const oldOrder = part.order;

    await this.presentationPartRepository.remove(part);

    await this.presentationPartRepository
      .createQueryBuilder()
      .update(PresentationPartEntity)
      .set({ order: () => `"order" - 1` })
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
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
          return reject(err);
        }
        const ms = Math.round((metadata.format.duration ?? 0) * 1000);
        resolve(ms);
      });
    });
  }

  private async generateThumbnail(
    videoPath: string,
    durationMs: number,
  ): Promise<string> {
    const previewsDir = './uploads/previews';
    await fsPromises.mkdir(previewsDir, { recursive: true });

    const baseName = path.basename(videoPath, path.extname(videoPath));
    const fileName = `${baseName}.png`;
    const outputPath = path.join(previewsDir, fileName);

    try {
      await fsPromises.access(outputPath);
      return outputPath;
    } catch {
      /* empty */
    }

    const midSeconds = Math.floor(durationMs / 1000 / 2);

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .screenshots({
          count: 1,
          timemarks: [midSeconds.toString()],
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

  async startVideoRecording(
    userId: number,
    presentationId: number,
  ): Promise<StandardResponse<StartVideoRecordingDto>> {
    await this.findOneById(presentationId, userId);

    const activeSession = await this.presentationStartRepository.findOne({
      where: { presentation: { presentationId }, endDate: IsNull() },
    });

    if (!activeSession) {
      throw new NotFoundException('No active presentation session');
    }

    const user = await this.userRepository
      .createQueryBuilder('u')
      .leftJoinAndMapOne(
        'u.userPremium',
        UserWithPremiumEntity,
        'prem',
        'prem.user_id = u.user_id',
      )
      .where('u.user_id = :id', { id: userId })
      .getOne();

    const userHasPremium = user?.userPremium?.has_premium === true;

    if (!userHasPremium) {
      const videosCount = await this.videoRepository
        .createQueryBuilder('v')
        .innerJoin('v.presentationStart', 'ps')
        .where('ps.presentation_start_id = :startId', {
          startId: activeSession.presentationStartId,
        })
        .andWhere('v.userUserId = :uid', { uid: userId })
        .getCount();

      if (videosCount >= FREE_VIDEOS_PER_PRESENTATION) {
        throw new ForbiddenException(
          `Free users can upload up to ${FREE_VIDEOS_PER_PRESENTATION} videos per presentation`,
        );
      }
    }

    return {
      error: false,
      data: {
        presentation_start_id: activeSession.presentationStartId,
        current_timestamp: Date.now(),
      },
    };
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

    const presentationStart = await this.presentationStartRepository.findOne({
      where: {
        presentationStartId: dto.presentationStartId,
        presentation: { presentationId: presentationId },
      },
    });

    if (!presentationStart) {
      throw new NotFoundException('No matching presentation start found');
    }

    const user = await this.userRepository
      .createQueryBuilder('u')
      .leftJoinAndMapOne(
        'u.userPremium',
        UserWithPremiumEntity,
        'prem',
        'prem.user_id = u.user_id',
      )
      .where('u.user_id = :id', { id: userId })
      .getOne();
    const userHasSubscription = user?.userPremium?.has_premium === true;

    if (!userHasSubscription) {
      const existingVideosCount = await this.videoRepository
        .createQueryBuilder('v')
        .innerJoin('v.presentationStart', 'ps')
        .innerJoin('ps.presentation', 'p')
        .where('p.presentation_id = :pid', { pid: presentationId })
        .andWhere('v.userUserId = :uid', { uid: userId })
        .getCount();

      if (existingVideosCount >= FREE_VIDEOS_PER_PRESENTATION) {
        throw new ForbiddenException(
          `Free users can upload up to ${FREE_VIDEOS_PER_PRESENTATION} videos per presentation`,
        );
      }
    }

    const durationMs = await this.probeDurationMs(file.path);
    if (
      !userHasSubscription &&
      durationMs >
        (MAX_FREE_RECORDING_TIME_SECONDS + VIDEO_DURATION_MAX_TAIL_SECONDS) *
          1000
    ) {
      throw new BadRequestException(
        `Free videos must be at most ${MAX_FREE_RECORDING_TIME_SECONDS} seconds long`,
      );
    }

    const thumbnailPath = await this.generateThumbnail(file.path, durationMs);
    const shareCode = this.generatePresentationShareCode();
    const videoEntity = this.videoRepository.create({
      presentationStart,
      link: file.path,
      title: `Частина ${dto.partOrder} - ${dto.partName}`,
      duration: durationMs,
      photoPreviewLink: thumbnailPath,
      shareCode,
      recordingStartDate: new Date(dto.startTimestamp),
      user: presentation.participants[0].user,
    });
    await this.videoRepository.save(videoEntity);

    this.presentationsGateway.emitPresentationEvent(
      presentationId,
      PresentationEventType.VideosChanged,
    );
    return {
      error: false,
      data: this.presentationsMapper.toVideoDto(videoEntity),
    };
  }

  async streamPresentationVideo(
    videoId: number,
    userId: number,
    req: Request,
    res: Response,
  ): Promise<void> {
    const video = await this.videoRepository.findOne({
      where: { videoId },
      relations: ['user', 'presentationStart.presentation'],
    });
    if (!video) throw new NotFoundException('Video not found');

    const presentation = await this.findOneById(
      video.presentationStart.presentation.presentationId,
      userId,
    );

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
    const range = req.headers['range'];

    if (range) {
      const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
      const start = parseInt(startStr, 10);
      const end = endStr ? parseInt(endStr, 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      res.status(HttpStatus.PARTIAL_CONTENT).set({
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': 'video/webm',
      });

      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.status(HttpStatus.OK).set({
        'Content-Length': fileSize,
        'Content-Type': 'video/webm',
      });

      fs.createReadStream(filePath).pipe(res);
    }
  }

  async getVideoShareCode(
    videoId: number,
    userId: number,
  ): Promise<StandardResponse<{ shareCode: string }>> {
    const video = await this.videoRepository.findOne({
      where: { videoId },
      relations: [
        'user',
        'presentationStart',
        'presentationStart.presentation',
        'presentationStart.presentation.owner.user',
      ],
    });
    if (!video) throw new NotFoundException('Video not found');

    const ownerId = video.presentationStart.presentation.owner.user.userId;
    const uploaderId = video.user.userId;
    if (userId !== ownerId && userId !== uploaderId) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }

    return {
      data: {
        shareCode: video.shareCode,
      },
      error: false,
    };
  }

  async removeVideo(videoId: number, userId: number): Promise<void> {
    const video = await this.videoRepository.findOne({
      where: { videoId },
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

    await fsPromises.unlink(videoFsPath).catch(() => {});
    await fsPromises.unlink(previewFsPath).catch(() => {});

    await this.videoRepository.softRemove(video);
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
      where: { presentationId },
      relations: ['owner', 'owner.user'],
    });
    if (!presentation) {
      throw new NotFoundException('Presentation not found');
    }

    const isOwner = presentation.owner.user.userId === userId;
    const queryBuilder = this.videoRepository
      .createQueryBuilder('video')
      .innerJoinAndSelect('video.presentationStart', 'ps')
      .innerJoin('ps.presentation', 'p', 'p.presentationId = :pid', {
        pid: presentationId,
      })
      .innerJoinAndSelect('video.user', 'u')
      .orderBy('video.recordingStartDate', 'DESC');

    if (!isOwner) {
      queryBuilder.andWhere('u.userId = :uid', { uid: userId });
    }

    const videos = await queryBuilder.getMany();
    const data = videos.map((v) => this.presentationsMapper.toVideoDto(v));

    return {
      error: false,
      data,
    };
  }

  private async getPresentationStart(presentationId: number) {
    return this.presentationStartRepository.findOne({
      where: { presentation: { presentationId }, endDate: IsNull() },
    });
  }

  async startPresentation(
    userId: number,
    presentationId: number,
  ): Promise<void> {
    const presentation = await this.findOneById(presentationId, userId);

    const activePresentation =
      await this.teleprompterGateway.getActivePresentation(presentationId);
    if (activePresentation?.currentOwnerUserId !== userId) {
      throw new ForbiddenException(
        'You are not the owner of the presentation or there are no users in the active presentation',
      );
    }

    const existingSession = await this.getPresentationStart(presentationId);
    if (existingSession) {
      throw new HttpException(
        'Conflict: already launched',
        HttpStatus.CONFLICT,
      );
    }

    const newSession = this.presentationStartRepository.create({
      presentation,
      startDate: new Date(),
    });
    await this.presentationStartRepository.save(newSession);
    this.presentationsGateway.emitPresentationEvent(
      presentationId,
      PresentationEventType.PresentationStarted,
    );
    await this.partsGateway.flushPresentationChanges(presentationId);
    await this.teleprompterGateway.setTeleprompterState(presentationId, true);
  }

  async stopPresentation(
    userId: number,
    presentationId: number,
  ): Promise<void> {
    const activePresentation =
      await this.teleprompterGateway.getActivePresentation(presentationId);
    if (activePresentation?.currentOwnerUserId !== userId) {
      throw new ForbiddenException('You are not the owner of the presentation');
    }

    const activeSession = await this.getPresentationStart(presentationId);
    if (!activeSession) {
      throw new HttpException(
        'Conflict: not currently launched',
        HttpStatus.CONFLICT,
      );
    }
    activeSession.endDate = new Date();
    await this.presentationStartRepository.save(activeSession);
    this.presentationsGateway.emitPresentationEvent(
      presentationId,
      PresentationEventType.PresentationStopped,
    );
    await this.teleprompterGateway.setTeleprompterState(presentationId, false);
  }

  async getActivePresentation(
    userId: number,
    presentationId: number,
  ): Promise<StandardResponse<ActivePresentationWithUsersDto | null>> {
    await this.findOneById(presentationId, userId);
    return {
      data: await this.teleprompterGateway.getActivePresentation(
        presentationId,
      ),
      error: false,
    };
  }

  async changeUserRecordingMode(
    userId: number,
    presentationId: number,
    isActive: boolean,
  ): Promise<StandardResponse<void>> {
    await this.findOneById(presentationId, userId);
    await this.teleprompterGateway.changeJoinedUserRecordingMode(
      userId,
      presentationId,
      isActive,
    );
    return {
      error: false,
    };
  }

  async getParticipantsVideosLeft(
    userId: number,
    presentationId: number,
  ): Promise<StandardResponse<VideosLeftDto[]>> {
    await this.findOneById(presentationId, userId);
    const activePresentation =
      await this.teleprompterGateway.getActivePresentation(presentationId);
    if (activePresentation?.currentOwnerUserId !== userId) {
      throw new ForbiddenException(
        'You are not the owner of the presentation or there are no users in the active presentation',
      );
    }

    const participants = await this.participantRepository.find({
      where: { presentationId },
      relations: ['user'],
    });
    const participantUserIds = participants.map((p) => p.user.userId);
    if (participantUserIds.length === 0) {
      return { error: false, data: [] };
    }

    const rawCounts = await this.videoRepository
      .createQueryBuilder('video')
      .innerJoin('video.presentationStart', 'ps')
      .innerJoin('ps.presentation', 'p')
      .innerJoin('video.user', 'u')
      .leftJoin(
        UserWithPremiumEntity,
        'up',
        'up.user_id = u.user_id AND up.has_premium = true',
      )
      .where('p.presentation_id = :presentationId', { presentationId })
      .andWhere('u.user_id IN (:...participantUserIds)', { participantUserIds })
      .andWhere('up.user_id IS NULL')
      .select('u.user_id', 'userId')
      .addSelect('COUNT(video.video_id)', 'recordedVideosCount')
      .groupBy('u.user_id')
      .getRawMany<{ userId: number; recordedVideosCount: string }>();

    const countMap = new Map<number, number>();
    for (const { userId: uid, recordedVideosCount } of rawCounts) {
      countMap.set(uid, Number(recordedVideosCount));
    }

    const premiumRows = await this.userWithPremiumRepository.find({
      select: ['user_id'],
      where: {
        user_id: In(participantUserIds),
        has_premium: true,
      },
    });
    const premiumSet = new Set(premiumRows.map((r) => r.user_id));

    const result = participants.map((p) => {
      const uid = p.user.userId;
      if (premiumSet.has(uid)) {
        return new VideosLeftDto(uid, null);
      }
      const notUploaded =
        activePresentation.userRecordedVideos.find((v) => v.userId === uid)
          ?.recordedVideosCount ?? 0;
      const uploaded = countMap.get(uid) ?? 0;
      const totalRecorded = uploaded + notUploaded;
      const left = Math.max(FREE_VIDEOS_PER_PRESENTATION - totalRecorded, 0);
      return new VideosLeftDto(uid, left);
    });

    return { error: false, data: result };
  }

  async sendActivePartChangeReaderConfirmation(
    userId: number,
    presentationId: number,
    newReaderId: number,
  ): Promise<StandardResponse<void>> {
    await this.findOneById(presentationId, userId);
    const activePresentation =
      await this.teleprompterGateway.getActivePresentation(presentationId);

    if (!activePresentation?.currentPresentationStartDate) {
      throw new NotFoundException('No active presentation session found');
    }

    if (activePresentation?.currentOwnerUserId !== userId) {
      throw new ForbiddenException(
        'You are not the owner of the presentation or there are no users in the active presentation',
      );
    }
    await this.teleprompterGateway.emitPartReadingConfirmationRequiredEvent(
      presentationId,
      newReaderId,
    );
    return {
      error: false,
    };
  }

  async confirmActivePartChangeReader(
    userId: number,
    presentationId: number,
    isFromStartPosition: boolean,
  ): Promise<StandardResponse<void>> {
    await this.findOneById(presentationId, userId);
    const activePresentation =
      await this.teleprompterGateway.getActivePresentation(presentationId);
    if (activePresentation?.awaitingConfirmationUserId !== userId) {
      throw new ForbiddenException('You have no awaiting confirmation');
    }
    await this.teleprompterGateway.changeCurrentPartReader(
      presentationId,
      userId,
      isFromStartPosition,
    );
    return {
      error: false,
    };
  }
}
