import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { ModeratorStatus } from '../../common/enum/ModeratorStatus';

@Entity('moderator')
export class ModeratorEntity {
  @PrimaryGeneratedColumn({ name: 'moderator_id' })
  moderatorId: number;

  @Column({ name: 'first_name', length: 100 })
  firstName: string;

  @Column({ name: 'last_name', length: 100 })
  lastName: string;

  @Column({ name: 'password', length: 255 })
  password: string;

  @Column({ name: 'email', unique: true, length: 100 })
  email: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: ModeratorStatus,
    default: ModeratorStatus.OFFLINE,
  })
  status: ModeratorStatus;

  @Column({ name: 'google_id', nullable: true })
  googleId?: string;

  @Column({ name: 'facebook_id', nullable: true })
  facebookId?: string;

  @Column({ name: 'refresh_token', nullable: true })
  refreshToken?: string;

  @Column({ name: 'access_token', nullable: true })
  accessToken?: string;
}
