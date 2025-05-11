import { Injectable } from '@nestjs/common';
import {ChatMessageEntity} from "../common/entities/ChatMessageEntity";
import {ChatMessageDto} from "./dto/ChatMessageDto";
import {ChatEntity} from "../common/entities/ChatEntity";
import {ChatDto} from "./dto/ChatDto";
@Injectable()
export class ChatMapper {
  toChatMessageDto(chatMessage: ChatMessageEntity): ChatMessageDto {
    return {
      chat_message_id: chatMessage.chatMessageId,
      text: chatMessage.text,
      is_written_by_moderator: chatMessage.isWrittenByModerator,
      sent_date: chatMessage.sentDate
    };
  }

  toChatMessagesList(chatMessages: ChatMessageEntity[]): ChatMessageDto[] {
    return chatMessages.map(message => this.toChatMessageDto(message));
  }
}
