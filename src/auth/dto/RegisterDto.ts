import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ description: 'User first name' })
  @MaxLength(100)
  @IsNotEmpty()
  readonly firstName: string;

  @ApiProperty({ description: 'User last name' })
  @MaxLength(100)
  @IsNotEmpty()
  readonly lastName: string;

  @ApiProperty({ description: 'User email address' })
  @IsEmail()
  @MaxLength(100)
  @IsNotEmpty()
  readonly email: string;

  @ApiProperty({ description: 'User password' })
  @MaxLength(255)
  @MinLength(4)
  @IsNotEmpty()
  readonly password: string;
}
