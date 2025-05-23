import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('admin')
export class AdminEntity {
  @PrimaryGeneratedColumn({ name: 'admin_id' })
  adminId: number;

  @Column({ name: 'password', length: 255 })
  password: string;

  @Column({ name: 'email', unique: true, length: 100 })
  email: string;

  @Column({ name: 'google_id', nullable: true })
  googleId?: string;

  @Column({ name: 'facebook_id', nullable: true })
  facebookId?: string;

  @Column({ name: 'refresh_token', nullable: true })
  refreshToken?: string;

  @Column({ name: 'access_token', nullable: true })
  accessToken?: string;
}
