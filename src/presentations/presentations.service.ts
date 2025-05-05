import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PresentationEntity } from '../common/entities/PresentationEntity';
import { ParticipantEntity } from '../common/entities/ParticipantEntity';
import { InvitationEntity } from '../common/entities/InvitationEntity';
import { DEFAULT_PRESENTATION_NAME } from '../common/Constants';

import { UpdatePresentationDto } from './dto/UpdatePresentationDto';
import { ParticipantDto } from './dto/ParticipantDto';
import { PresentationDto } from './dto/PresentationDto';
import { PresentationStatsResponseDto } from './dto/PresentationStatsResponseDto';
import { StandardResponse } from '../common/interface/StandardResponse';
import { randomBytes } from 'crypto';
import { ColorService } from './color.service';
import { UserWithPremiumEntity } from '../common/entities/UserWithPremiumEntity';
import { PresentationMapper } from './presentaion.mapper';
import { InvitationDto } from './dto/InvitationDto';

@Injectable()
export class PresentationsService {
  constructor(
    @InjectRepository(PresentationEntity)
    private readonly presentationRepository: Repository<PresentationEntity>,
    @InjectRepository(ParticipantEntity)
    private readonly participantRepository: Repository<ParticipantEntity>,
    @InjectRepository(InvitationEntity)
    private readonly invitationRepository: Repository<InvitationEntity>,
    private readonly colorService: ColorService,
    private readonly presentationsMapper: PresentationMapper,
  ) {}

  async create(userId: number): Promise<StandardResponse<PresentationDto>> {
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

    return {
      data: this.presentationsMapper.toPresentationDto(
        await this.findOneById(presentation.presentationId, userId),
      ),
      error: false,
    };
  }

  async getStats(
    userId: number,
  ): Promise<StandardResponse<PresentationStatsResponseDto>> {
    const presentationCount = await this.presentationRepository.count({
      where: { owner: { userId } },
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
    return {
      data: {
        presentation_count: presentationCount,
        invited_participants: invitedParticipants,
        recordings_made: 0,
      },
      error: false,
    };
  }

  async findAll(
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
      .where('ownerUser.user_id = :userId', { userId })
      .orWhere('participantUser.user_id = :userId', { userId })
      .orderBy('presentation.modifiedAt', 'DESC')
      .skip(offset)
      .take(limit)
      .getMany();

    return {
      data: this.presentationsMapper.toPresentationList(entities),
      error: false,
    };
  }

  private async findOneById(
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

  async findOne(
    userId: number,
    id: number,
  ): Promise<StandardResponse<PresentationDto>> {
    const presentation = await this.findOneById(id, userId);
    return {
      data: this.presentationsMapper.toPresentationDto(presentation),
      error: false,
    };
  }

  async update(
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
    return {
      data: this.presentationsMapper.toPresentationDto(
        await this.findOneById(id, userId),
      ),
      error: false,
    };
  }

  async remove(userId: number, id: number): Promise<StandardResponse<any>> {
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

  async listParticipants(
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
      .where('participant.participantId = :id', { id })
      .getOne()
      .then((p) => p?.presentation.presentationId);

    const presentation = await this.findOneById(presentationId!, userId);
    if (presentation.owner.userId !== userId) {
      throw new ForbiddenException(
        `You are not the owner of presentation ${id}`,
      );
    }
    const participant = await this.participantRepository.findOne({
      where: { participantId: id },
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
    return {
      error: false,
    };
  }

  async invite(
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
  ): Promise<StandardResponse<any>> {
    const invitation = await this.invitationRepository.findOne({
      where: { code },
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
        user: { userId },
      },
    });

    if (existingParticipant) {
      throw new ForbiddenException(
        `You are already a participant of presentation ${invitation.presentation.presentationId}`,
      );
    }

    const part = this.participantRepository.create({
      presentation: invitation.presentation,
      user: { userId },
      color: await this.colorService.generateNextHexColor(
        invitation.presentationId,
      ),
    });
    await this.participantRepository.save(part);

    return {
      error: false,
    };
  }
}
