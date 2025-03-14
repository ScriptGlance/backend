import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ description: 'User first name' })
  readonly firstName: string;

  @ApiProperty({ description: 'User last name' })
  readonly lastName: string;

  @ApiProperty({ description: 'User email address' })
  readonly email: string;

  @ApiProperty({ description: 'User password' })
  readonly password: string;
}
