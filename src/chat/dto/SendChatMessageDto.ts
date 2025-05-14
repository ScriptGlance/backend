import { IsString, MaxLength } from 'class-validator';
import {ApiProperty} from "@nestjs/swagger";

export class SendChatMessageDto {
    @ApiProperty()
    @IsString()
    @MaxLength(1000)
    text: string;
}
