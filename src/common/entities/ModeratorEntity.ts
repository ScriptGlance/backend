import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { ChatEntity } from './ChatEntity';

@Entity('moderator')
@Index('UQ_moderator_email_not_deleted', ['email'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
export class ModeratorEntity {
  @PrimaryGeneratedColumn({ name: 'moderator_id' })
  moderatorId: number;

  @Column({ name: 'first_name', length: 100 })
  firstName: string;

  @Column({ name: 'last_name', length: 100 })
  lastName: string;

  @Column({ name: 'avatar', nullable: true })
  avatar?: string;

  @Column({ name: 'password', length: 255 })
  password: string;

  @Column({ name: 'email', length: 100 })
  email: string;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;

  @Column({ name: 'is_temporary_password', default: false })
  isTemporaryPassword: boolean;

  @OneToMany(() => ChatEntity, (assignedChat) => assignedChat.assignedModerator)
  assignedChats: ChatEntity[];
}
