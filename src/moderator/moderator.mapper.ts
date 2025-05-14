import { Injectable } from '@nestjs/common';
import {ModeratorDto} from "./dto/ModeratorDto";
import {ModeratorEntity} from "../common/entities/ModeratorEntity";
@Injectable()
export class ModeratorMapper {
  toModeratorDto(moderator: ModeratorEntity): ModeratorDto {
    return {
      avatar: moderator.avatar ? '/' + moderator.avatar.replace('uploads/', '') : null,
      moderator_id: moderator.moderatorId,
      first_name: moderator.firstName,
      last_name: moderator.lastName,
      email: moderator.email,
      joined_at: moderator.joinedAt,
    };
  }
}
