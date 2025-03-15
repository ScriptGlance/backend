import {ApiProperty} from "@nestjs/swagger";

export class LoginDto {
  @ApiProperty({ description: 'User email address' })
  email: string;
  @ApiProperty({ description: 'User password' })
  password: string;
}
