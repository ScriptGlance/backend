import { Injectable } from '@nestjs/common';
import { ChatMessageEntity } from '../common/entities/ChatMessageEntity';
import { ChatMessageDto } from './dto/ChatMessageDto';
import { ChatEntity } from '../common/entities/ChatEntity';
import { ChatDto } from './dto/ChatDto';

@Injectable()
export class ChatMapper {
  toChatMessageDto(chatMessage: ChatMessageEntity): ChatMessageDto {
    return {
      chat_message_id: chatMessage.chatMessageId,
      text: chatMessage.text,
      is_written_by_moderator: chatMessage.isWrittenByModerator,
      sent_date: chatMessage.sentDate,
    };
  }

  toChatMessagesList(chatMessages: ChatMessageEntity[]): ChatMessageDto[] {
    return chatMessages.map((message) => this.toChatMessageDto(message));
  }

  toChatDto(
    chat: ChatEntity,
    lastMessage: ChatMessageEntity | null,
    unreadCount: number,
  ): ChatDto {
    return {
      chat_id: chat.chatId,
      user_first_name: chat.user.firstName,
      user_last_name: chat.user.lastName,
      avatar: chat.user.avatar
        ? '/' + chat.user.avatar.replace('uploads/', '')
        : null,
      user_id: chat.user.userId,
      last_message: lastMessage?.text ?? '',
      last_message_sent_date: lastMessage?.sentDate ?? new Date(0),
      unread_messages_count: unreadCount,
      assigned_moderator_id: chat.assignedModerator?.moderatorId ?? null,
    };
  }
}
