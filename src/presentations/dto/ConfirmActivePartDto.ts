import {ApiProperty} from "@nestjs/swagger";
import {IsBoolean} from "class-validator";

export class ConfirmActivePartDto {
    @ApiProperty()
    @IsBoolean()
    is_from_start_position: boolean;
}