import {ApiProperty} from "@nestjs/swagger";

export class ResetPasswordDto {
  @ApiProperty({ description: 'Password reset token' })
  token: string;
  @ApiProperty({ description: 'User new password' })
  newPassword: string;
}
