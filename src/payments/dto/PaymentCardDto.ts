import { PaymentSystem } from '../../common/enum/PaymentSystem';

export class PaymentCardDto {
  masked_number: string;
  payment_system: PaymentSystem;
}