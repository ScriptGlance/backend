import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { ChatEntity } from './ChatEntity';

@Entity('chat_message')
export class ChatMessageEntity {
  @PrimaryGeneratedColumn({ name: 'chat_message_id' })
  chatMessageId: number;

  @Column({ name: 'text', length: 1000 })
  text: string;

  @Column({ name: 'sent_date' })
  sentDate: Date;

  @Column({ name: 'is_written_by_moderator' })
  isWrittenByModerator: boolean;

  @Column({ name: 'is_read', default: false })
  isRead: boolean;

  @ManyToOne(() => ChatEntity, (chat) => chat.chatMessages)
  chat: ChatEntity;
}
