import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CancelStatus } from '../../common/enum/CancelStatus';
import { IsDateString, IsEnum, IsInt, IsOptional } from 'class-validator';

export class CancelRequestDto {
  @ApiProperty({ enum: CancelStatus })
  @IsEnum(CancelStatus)
  @IsOptional()
  status?: CancelStatus;

  @ApiPropertyOptional({
    type: 'integer',
    description: 'Amount in minimum currency units',
  })
  @IsOptional()
  @IsInt()
  amount?: number;

  @ApiPropertyOptional({
    type: 'integer',
    description: 'ISO 4217 currency code',
  })
  @IsOptional()
  @IsInt()
  ccy?: number;

  @ApiProperty({ type: String, format: 'date-time' })
  @IsDateString()
  createdDate: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @IsDateString()
  modifiedDate: string;
}