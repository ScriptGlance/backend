import { ChatMessageDto } from './ChatMessageDto';

export class ModeratorChatMessageEventDto extends ChatMessageDto {
  is_assigned: boolean;
  is_new_chat: boolean;
  chat_id: number;
  user_first_name: string;
  user_last_name: string;
  user_id: number;
  avatar?: string;
}
