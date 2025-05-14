import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InvoiceStatus } from '../../common/enum/InvoiceStatus';
import { WalletDataDto } from './WalletDataDto';
import { PaymentInfoDto } from './PaymentInfoDto';
import { CancelRequestDto } from './CancelRequestDto';

export class InvoiceStatusDto {
  @ApiProperty({ type: String, description: 'Invoice identifier' })
  @IsString()
  invoiceId: string;

  @ApiProperty({ enum: InvoiceStatus, description: 'Operation status' })
  @IsEnum(InvoiceStatus)
  status: InvoiceStatus;

  @ApiProperty({
    type: 'integer',
    description: 'Amount in minimum currency units',
  })
  @IsInt()
  amount: number;

  @ApiProperty({ type: 'integer', description: 'ISO 4217 currency code' })
  @IsInt()
  ccy: number;

  @ApiPropertyOptional({
    type: 'integer',
    description: 'Final amount after all operations',
  })
  @IsOptional()
  @IsInt()
  finalAmount?: number;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Creation date and time',
  })
  @IsDateString()
  createdDate: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Last modification date and time',
  })
  @IsDateString()
  modifiedDate: string;

  @ApiPropertyOptional({ type: String, description: 'Rejection reason' })
  @IsOptional()
  @IsString()
  failureReason?: string;

  @ApiPropertyOptional({ type: String, description: 'Error code' })
  @IsOptional()
  @IsString()
  errCode?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Payment reference defined by the merchant',
  })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Payment purpose defined by the merchant',
  })
  @IsOptional()
  @IsString()
  destination?: string;

  @ApiPropertyOptional({
    type: [CancelRequestDto],
    description: 'List of cancellation requests',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CancelRequestDto)
  cancelList?: CancelRequestDto[];

  @ApiPropertyOptional({
    type: WalletDataDto,
    description: 'Tokenized card data',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => WalletDataDto)
  walletData?: WalletDataDto;

  @ApiPropertyOptional({
    type: PaymentInfoDto,
    description: 'Payment transaction data',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentInfoDto)
  paymentInfo?: PaymentInfoDto;
}
