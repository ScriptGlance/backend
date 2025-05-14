import { PaymentType } from '../../common/enum/PaymentType';
import { PaymentByTokenInitiationKind } from '../../common/enum/PaymentByTokenInitiationKind';

export interface PaymentByTokenRequestDto {
  amount: number;
  ccy: number;
  redirectUrl: string;
  webHookUrl: string;
  paymentType: PaymentType;
  cardToken: string;
  initiationKind: PaymentByTokenInitiationKind;
}
