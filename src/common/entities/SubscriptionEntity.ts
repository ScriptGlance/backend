import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from './UserEntity';
import { SubscriptionStatus } from '../enum/SubscriptionStatus';

@Entity('subscription')
export class SubscriptionEntity {
  @PrimaryGeneratedColumn({ name: 'subscription_id' })
  subscriptionId: number;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.ACTIVE,
  })
  status: SubscriptionStatus;

  @Column({ name: 'next_payment_date', type: 'timestamp' })
  nextPaymentDate: Date;

  @Column({ name: 'start_date', type: 'timestamp' })
  startDate: Date;

  @Column({ name: 'wallet_id' })
  walletId: number;

  @Column({ name: 'cancellation_date', type: 'timestamp', nullable: true })
  cancellationDate?: Date;

  @OneToOne(() => UserEntity, (user) => user.subscription, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}
