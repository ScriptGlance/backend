import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('admin')
export class AdminEntity {
  @PrimaryGeneratedColumn({ name: 'admin_id' })
  adminId: number;

  @Column({ name: 'password', length: 255 })
  password: string;

  @Column({ name: 'email', unique: true, length: 100 })
  email: string;

}
