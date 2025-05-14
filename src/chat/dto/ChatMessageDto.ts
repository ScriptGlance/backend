export class ChatMessageDto {
  chat_message_id: number;
  is_written_by_moderator: boolean;
  text: string;
  sent_date: Date;
}
