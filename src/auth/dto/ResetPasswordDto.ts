import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, MaxLength, MinLength } from 'class-validator';
import { Role } from '../../common/enum/Role';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Password reset token' })
  @IsNotEmpty()
  token: string;

  @ApiProperty({ description: 'User new password' })
  @MaxLength(255)
  @MinLength(4)
  @IsNotEmpty()
  newPassword: string;

  @ApiProperty({
    description: 'User role',
    enum: Role,
    example: Role.User,
  })
  @IsEnum(Role, { message: 'Role must be either user, moderator, or admin' })
  @IsNotEmpty()
  role: Role;
}
