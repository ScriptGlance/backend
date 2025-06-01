import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { Role } from '../../common/enum/Role';

export class MobileSocialLoginDto {
  @ApiProperty({ enum: ['google', 'facebook'] })
  @IsEnum(['google', 'facebook'])
  provider: 'google' | 'facebook';

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ enum: Role })
  @IsEnum(Role)
  role: Role;
}
