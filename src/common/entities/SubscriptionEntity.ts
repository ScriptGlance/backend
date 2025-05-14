import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { UserEntity } from './UserEntity';
import { SubscriptionStatus } from '../enum/SubscriptionStatus';
import { PaymentCardEntity } from './PaymentCardEntity';
import { TransactionEntity } from './TransactionEntity';

@Entity('subscription')
export class SubscriptionEntity {
  @PrimaryGeneratedColumn({ name: 'subscription_id' })
  subscriptionId: number;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.CREATED,
  })
  status: SubscriptionStatus;

  @Column({
    name: 'next_payment_date',
    type: 'timestamp',
    nullable: true,
    default: null,
  })
  nextPaymentDate: Date | null;

  @Column({
    name: 'start_date',
    type: 'timestamp',
    nullable: true,
    default: null,
  })
  startDate: Date | null;

  @Column({ name: 'wallet_id', unique: true })
  walletId: string;

  @Column({
    name: 'cancellation_date',
    type: 'timestamp',
    nullable: true,
    default: null,
  })
  cancellationDate: Date | null;

  @OneToOne(() => UserEntity, (user) => user.subscription, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ name: 'payment_card_id', nullable: true })
  paymentCardId: number;

  @OneToOne(() => PaymentCardEntity, (card) => card.subscription, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'payment_card_id' })
  paymentCard: PaymentCardEntity;

  @OneToMany(() => TransactionEntity, (transaction) => transaction.subscription)
  transactions: TransactionEntity[];
}
