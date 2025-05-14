import { SubscriptionStatus } from '../../common/enum/SubscriptionStatus';
import { PaymentCardDto } from './PaymentCardDto';

export class SubscriptionDto {
  status: SubscriptionStatus;
  next_payment_date: Date | null;
  payment_card: PaymentCardDto | null;
}
