import {ApiProperty} from "@nestjs/swagger";
import {IsBoolean} from "class-validator";

export class ChangeRecordingModeDto {
    @ApiProperty()
    @IsBoolean()
    is_active: boolean;
}