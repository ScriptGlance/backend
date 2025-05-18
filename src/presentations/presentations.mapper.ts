import { Injectable } from '@nestjs/common';
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
import {UserMapper} from "../user/user.mapper";

@Injectable()
export class PresentationMapper {
  constructor(private readonly userMapper: UserMapper) {}

  toParticipantDto(participant: ParticipantEntity): ParticipantDto {
    return {
      participant_id: participant.participantId,
      color: participant.color,
      user: this.userMapper.toUserDto(participant.user),
    };
  }

  toPresentationDto(presentation: PresentationEntity): PresentationDto {
    return {
      presentation_id: presentation.presentationId,
      name: presentation.name,
      created_at: presentation.createdAt,
      modified_at: presentation.modifiedAt,
      owner: this.userMapper.toUserDto(presentation.owner.user),
      participant_count: presentation.participants.length,
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
      assignee: this.userMapper.toUserDto(part.assignee.user),
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
      video_author: this.userMapper.toUserDto(video.user),
      presentation_start: {
        start_date: video.presentationStart.startDate,
        end_date: video.presentationStart.endDate,
      }
    }
  }
}
