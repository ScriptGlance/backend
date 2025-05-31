export class ChatDto {
  chat_id: number;
  user_full_name: string;
  avatar: string | null;
  last_message: string;
  last_message_sent_date: Date;
  unread_messages_count: number;
}
