import { Injectable } from '@nestjs/common';
import { UserEntity } from '../common/entities/UserEntity';
import { UserDto } from './dto/UserDto';
import { ParticipantEntity } from '../common/entities/ParticipantEntity';
import { ParticipantDto } from './dto/ParticipantDto';
import { PresentationEntity } from '../common/entities/PresentationEntity';
import { PresentationDto } from './dto/PresentationDto';
import { InvitationEntity } from '../common/entities/InvitationEntity';
import { InvitationDto } from './dto/InvitationDto';
import { PresentationPartEntity } from '../common/entities/PresentationPartEntity';
import { StructureItemDto } from './dto/StructureItemDto';
import { PartDto } from './dto/PartDto';
import {VideoEntity} from "../common/entities/VideoEntity";
import {VideoDto} from "./dto/VideoDto";

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

  toStructureItemDto(
    part: PresentationPartEntity,
    wordsCount: number,
  ): StructureItemDto {
    return {
      part_name: part.name,
      part_order: part.order,
      words_count: wordsCount,
      text_preview: part.text.slice(0, 100),
      assignee: this.toUserDto(part.assignee.user),
    };
  }

  toPartDto(part: PresentationPartEntity): PartDto {
    return {
      part_id: part.presentationPartId,
      part_name: part.name,
      part_text: part.text,
      part_order: part.order,
      assignee_participant_id: part.assigneeParticipantId,
    };
  }

  toVideoDto(video: VideoEntity): VideoDto {
    return {
      video_id: video.videoId,
      video_title: video.title,
      video_duration: video.duration,
      video_thumbnail: '/' + video.photoPreviewLink.replace('uploads/', ''),
      video_author: this.toUserDto(video.user),
    }
  }
}
