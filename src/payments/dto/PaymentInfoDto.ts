import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { PaymentSystem } from '../../common/enum/PaymentSystem';

export class PaymentInfoDto {
  @ApiPropertyOptional({
    type: String,
    description: 'Transaction authorization code',
  })
  @IsOptional()
  @IsString()
  approvalCode?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Transaction identifier in the system',
  })
  @IsOptional()
  @IsString()
  rrn?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Transaction identifier',
  })
  @IsOptional()
  @IsString()
  tranId?: string;

  @ApiProperty({ type: String, description: 'Terminal identifier' })
  @IsString()
  @IsOptional()
  terminal?: string;

  @ApiPropertyOptional({ type: String, description: 'Issuing bank name' })
  @IsOptional()
  @IsString()
  bank?: string;

  @ApiProperty({ enum: PaymentSystem, description: 'Card payment system' })
  @IsEnum(PaymentSystem)
  @IsOptional()
  paymentSystem?: PaymentSystem;

  @ApiPropertyOptional({ type: 'integer', description: 'Acquiring fee' })
  @IsOptional()
  @IsInt()
  fee?: number;

  @ApiPropertyOptional({
    type: String,
    description: 'Bank country (ISO-3166-1 numeric)',
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Masked card number',
  })
  @IsOptional()
  @IsString()
  maskedPan?: string;
}
