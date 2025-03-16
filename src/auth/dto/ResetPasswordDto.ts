import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Password reset token' })
  @IsNotEmpty()
  token: string;

  @ApiProperty({ description: 'User new password' })
  @MaxLength(255)
  @MinLength(4)
  @IsNotEmpty()
  newPassword: string;
}
