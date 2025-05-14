import { InvoiceStatus } from '../../common/enum/InvoiceStatus';

export class TransactionDto {
  id: number;
  date: Date;
  amount: number;
  currency: number;
  status: InvoiceStatus;
}
