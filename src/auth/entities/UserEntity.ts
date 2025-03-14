import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { TariffPlan } from '../../common/enum/TariffPlan';

@Entity('users')
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

  @Column({ name: 'photo_url', nullable: true })
  photoUrl?: string;

  @Column({
    type: 'enum',
    enum: TariffPlan,
    default: TariffPlan.BASIC,
  })
  plan?: TariffPlan;

  @Column({ name: 'google_id', nullable: true })
  googleId?: string;

  @Column({ name: 'facebook_id', nullable: true })
  facebookId?: string;

  @Column({ name: 'refresh_token', nullable: true })
  refreshToken?: string;

  @Column({ name: 'access_token', nullable: true })
  accessToken?: string;
}
