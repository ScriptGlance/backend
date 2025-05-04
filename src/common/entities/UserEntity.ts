import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { ParticipantEntity } from './ParticipantEntity';

@Entity('user')
export class UserEntity {
  @PrimaryGeneratedColumn({ name: 'user_id' })
  userId: number;

  @Column({ name: 'first_name', length: 100 })
  firstName: string;

  @Column({ name: 'last_name', length: 100 })
  lastName: string;

  @Column({ name: 'password', length: 255 })
  password: string;

  @Column({ name: 'email', unique: true, length: 100 })
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

  @Column({ name: 'deleted_at', nullable: true })
  deletedAt?: Date;

  @OneToMany(() => ParticipantEntity, (participant) => participant.user)
  participations: ParticipantEntity[];
}
