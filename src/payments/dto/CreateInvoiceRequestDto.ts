import { SaveCardDataDto } from './SaveCardDataDto';
import { PaymentType } from '../../common/enum/PaymentType';

export interface CreateInvoiceRequestDto {
  amount: number;
  ccy: number;
  redirectUrl: string;
  webHookUrl: string;
  paymentType: PaymentType;
  saveCardData?: SaveCardDataDto;
  validity: number;
}
