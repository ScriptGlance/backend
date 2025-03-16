import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, MaxLength } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ description: 'User email address' })
  @IsEmail()
  @MaxLength(100)
  @IsNotEmpty()
  email: string;
}
