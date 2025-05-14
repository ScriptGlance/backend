import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  OneToMany,
  CreateDateColumn,
  DeleteDateColumn,
  Index
} from 'typeorm';
import {PresentationEntity} from "./PresentationEntity";
import {ChatEntity} from "./ChatEntity";

@Entity('moderator')
@Index(
    'UQ_moderator_email_not_deleted',
    ['email'],
    { unique: true, where: '"deleted_at" IS NULL' },
)
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

  @Column({ name: 'google_id', nullable: true })
  googleId?: string;

  @Column({ name: 'facebook_id', nullable: true })
  facebookId?: string;

  @Column({ name: 'refresh_token', nullable: true })
  refreshToken?: string;

  @Column({ name: 'access_token', nullable: true })
  accessToken?: string;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;

  @Column({ name: 'is_temporary_password', default: false })
  isTemporaryPassword: boolean;

  @OneToMany(() => ChatEntity, (assignedChat) => assignedChat.assignedModerator)
  assignedChats: ChatEntity[];
}
