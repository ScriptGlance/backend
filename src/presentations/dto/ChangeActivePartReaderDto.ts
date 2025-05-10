import {IsInt} from "class-validator";
import {ApiProperty} from "@nestjs/swagger";

export class ChangeActivePartReaderDto {
    @ApiProperty()
    @IsInt()
    new_reader_id: number;
}