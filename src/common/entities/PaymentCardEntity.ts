import { Entity, PrimaryGeneratedColumn, Column, OneToOne } from 'typeorm';
import { SubscriptionEntity } from './SubscriptionEntity';

@Entity('payment_card')
export class PaymentCardEntity {
  @PrimaryGeneratedColumn({ name: 'payment_card_id' })
  paymentCardId: number;

  @Column({ name: 'token', length: 500 })
  token: string;

  @Column({ name: 'payment_system', length: 50 })
  paymentSystem?: string;

  @Column({ name: 'masked_number', length: 19 })
  maskedNumber: string;

  @OneToOne(
    () => SubscriptionEntity,
    (subscription) => subscription.paymentCard,
  )
  subscription: SubscriptionEntity;
}
