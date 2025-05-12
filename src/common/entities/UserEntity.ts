import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  OneToOne, DeleteDateColumn, CreateDateColumn, Index,
} from 'typeorm';
import { ParticipantEntity } from './ParticipantEntity';
import { SubscriptionEntity } from './SubscriptionEntity';
import { UserWithPremiumEntity } from './UserWithPremiumEntity';
import {VideoEntity} from "./VideoEntity";
import {ChatEntity} from "./ChatEntity";

@Entity('user')
@Index(
    'UQ_user_email_not_deleted',
    ['email'],
    { unique: true, where: '"deleted_at" IS NULL' },
)
export class UserEntity {
  @PrimaryGeneratedColumn({ name: 'user_id' })
  userId: number;

  @Column({ name: 'first_name', length: 100 })
  firstName: string;

  @Column({ name: 'last_name', length: 100 })
  lastName: string;

  @Column({ name: 'password', length: 255 })
  password: string;

  @Column({ name: 'email', length: 100 })
  email: string;

  @Column({ name: 'avatar', nullable: true })
  avatar?: string;

  @Column({ name: 'is_temporary_password', default: false })
  isTemporaryPassword: boolean;

  @Column({ name: 'google_id', nullable: true })
  googleId?: string;

  @Column({ name: 'facebook_id', nullable: true })
  facebookId?: string;

  @Column({ name: 'refresh_token', nullable: true })
  refreshToken?: string;

  @Column({ name: 'access_token', nullable: true })
  accessToken?: string;

  @CreateDateColumn({ name: 'registered_at' })
  registeredAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt?: Date;

  @OneToMany(() => ParticipantEntity, (participant) => participant.user)
  participations: ParticipantEntity[];

  @OneToOne(() => SubscriptionEntity, (sub) => sub.user)
  subscription: SubscriptionEntity;

  userPremium?: UserWithPremiumEntity;

  @OneToMany(() => VideoEntity, (video) => video.user)
  videos: VideoEntity[];

  @OneToMany(() => ChatEntity, (assignedChat) => assignedChat.user)
  chats: ChatEntity[];
}
