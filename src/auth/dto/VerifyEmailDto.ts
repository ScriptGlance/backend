import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, MaxLength, MinLength } from 'class-validator';
import { VERIFICATION_CODE_LENGTH } from '../../common/Constants';

export class VerifyEmailDto {
  @ApiProperty({ description: 'User email address' })
  @IsEmail()
  @MaxLength(100)
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Email verification code' })
  @MinLength(VERIFICATION_CODE_LENGTH)
  @MaxLength(VERIFICATION_CODE_LENGTH)
  @IsNotEmpty()
  code: string;
}
