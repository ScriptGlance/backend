import {ApiProperty} from "@nestjs/swagger";

export class SendVerificationEmailDto {
    @ApiProperty({ description: 'User email address' })
    email: string;
}