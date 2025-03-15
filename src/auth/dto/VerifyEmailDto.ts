import {ApiProperty} from "@nestjs/swagger";

export class VerifyEmailDto {
    @ApiProperty({ description: 'User email address' })
    email: string;
    @ApiProperty({ description: 'Email verification code' })
    code: string;
}