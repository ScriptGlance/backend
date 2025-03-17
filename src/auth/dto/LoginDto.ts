import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, MaxLength } from 'class-validator';
import { Role } from 'src/common/enum/Role';

export class LoginDto {
  @ApiProperty({ description: 'User email address' })
  @IsEmail()
  @MaxLength(100)
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'User password' })
  @MaxLength(255)
  @IsNotEmpty()
  password: string;

  @ApiProperty({
    description: 'User role',
    enum: Role,
    example: Role.User,
  })
  @IsEnum(Role, { message: 'Role must be either user, moderator, or admin' })
  @IsNotEmpty()
  role: Role;
}
