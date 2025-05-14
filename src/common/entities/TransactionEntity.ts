import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { InvoiceStatus } from '../enum/InvoiceStatus';
import { SubscriptionEntity } from './SubscriptionEntity';

@Entity('transaction')
export class TransactionEntity {
  @PrimaryGeneratedColumn({ name: 'transaction_id' })
  transactionId: number;

  @Column({ name: 'invoice_id' })
  invoiceId: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: InvoiceStatus,
    nullable: true,
    default: null,
  })
  status?: InvoiceStatus;

  @Column({ name: 'modified_date' })
  modifiedDate: Date;

  @Column({ name: 'currency', type: 'smallint' })
  currency: number;

  @Column({ name: 'amount', type: 'int' })
  amount: number;

  @Column({ name: 'subscription_id' })
  subscriptionId: number;

  @Column({ name: 'is_card_updating', default: false })
  isCardUpdating: boolean;

  @ManyToOne(
    () => SubscriptionEntity,
    (subscription) => subscription.transactions,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'subscription_id' })
  subscription: SubscriptionEntity;
}
