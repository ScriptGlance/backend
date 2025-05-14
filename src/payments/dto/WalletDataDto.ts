import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { WalletStatus } from '../../common/enum/WalletStatus';

export class WalletDataDto {
  @ApiProperty({ type: String, description: 'Buyer wallet identifier' })
  @IsString()
  @IsOptional()
  walletId?: string;

  @ApiProperty({ type: String, description: 'Card token' })
  @IsString()
  @IsOptional()
  cardToken?: string;

  @ApiProperty({ enum: WalletStatus, description: 'Card tokenization status' })
  @IsEnum(WalletStatus)
  @IsOptional()
  status?: WalletStatus;
}
