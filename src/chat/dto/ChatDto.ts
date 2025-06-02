export class ChatDto {
  chat_id: number;
  user_first_name: string;
  user_last_name: string;
  user_id: number;
  avatar: string | null;
  last_message: string;
  last_message_sent_date: Date;
  unread_messages_count: number;
}
