import { Injectable } from '@nestjs/common';
import { UserEntity } from '../common/entities/UserEntity';
import { UserDto } from './dto/UserDto';
import { ParticipantEntity } from '../common/entities/ParticipantEntity';
import { ParticipantDto } from './dto/ParticipantDto';
import { PresentationEntity } from '../common/entities/PresentationEntity';
import { PresentationDto } from './dto/PresentationDto';
import { InvitationEntity } from '../common/entities/InvitationEntity';
import { InvitationDto } from './dto/InvitationDto';

@Injectable()
export class PresentationMapper {
  toUserDto(user: UserEntity): UserDto {
    return {
      avatar: user.avatar,
      user_id: user.userId,
      name: user.firstName,
      surname: user.lastName,
      has_premium: user.userPremium?.has_premium ?? false,
    };
  }

  toParticipantDto(participant: ParticipantEntity): ParticipantDto {
    return {
      participant_id: participant.participantId,
      color: participant.color,
      user: this.toUserDto(participant.user),
    };
  }

  toPresentationDto(presentation: PresentationEntity): PresentationDto {
    return {
      presentation_id: presentation.presentationId,
      name: presentation.name,
      created_at: presentation.createdAt,
      modified_at: presentation.modifiedAt,
      owner: this.toUserDto(presentation.owner.user),
    };
  }

  toPresentationList(entities: PresentationEntity[]): PresentationDto[] {
    return entities.map((entity) => this.toPresentationDto(entity));
  }

  toInvitationDto(invitation: InvitationEntity): InvitationDto {
    return {
      invitation_code: invitation.code,
    };
  }
}
