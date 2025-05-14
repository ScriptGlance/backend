import {ApiProperty} from "@nestjs/swagger";
import {IsEmail, IsNotEmpty, IsString, MaxLength, MinLength} from "class-validator";

export class InviteDto {
    @ApiProperty()
    @MaxLength(100)
    @IsNotEmpty()
    readonly first_name: string;

    @ApiProperty()
    @MaxLength(100)
    @IsNotEmpty()
    readonly last_name: string;

    @ApiProperty()
    @IsEmail()
    @MaxLength(100)
    @IsNotEmpty()
    readonly email: string;
}