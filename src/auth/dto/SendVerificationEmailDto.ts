import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, MaxLength } from 'class-validator';
import { Role } from '../../common/enum/Role';

export class SendVerificationEmailDto {
  @ApiProperty({ description: 'User email address' })
  @IsEmail()
  @MaxLength(100)
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'User role',
    enum: Role,
    example: Role.User,
  })
  @IsEnum(Role, { message: 'Role must be either user, moderator, or admin' })
  @IsNotEmpty()
  role: Role;
}
