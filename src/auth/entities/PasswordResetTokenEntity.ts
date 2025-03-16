import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { UserEntity } from './UserEntity';
import { AdminEntity } from './AdminEntity';
import { ModeratorEntity } from './ModeratorEntity';

@Entity('password_reset_token')
export class PasswordResetTokenEntity {
  @PrimaryGeneratedColumn({ name: 'password_reset_token_id' })
  passwordResetTokenId: number;

  @ManyToOne(() => UserEntity, (user) => user.userId, { nullable: true })
  user?: UserEntity;

  @ManyToOne(() => AdminEntity, (admin) => admin.adminId, { nullable: true })
  admin?: AdminEntity;

  @ManyToOne(() => ModeratorEntity, (moderator) => moderator.moderatorId, {
    nullable: true,
  })
  moderator?: ModeratorEntity;

  @Column({ name: 'token' })
  token: string;

  @Column({ name: 'expires_at' })
  expiresAt: Date;
}
