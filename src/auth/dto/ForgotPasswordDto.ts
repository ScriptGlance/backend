import {ApiProperty} from "@nestjs/swagger";

export class ForgotPasswordDto {
  @ApiProperty({ description: 'User email address' })
  email: string;
}