import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber } from 'class-validator';

export class VideoUploadDto {
    @ApiProperty({ description: 'Part name' })
    @IsNotEmpty()
    readonly partName: string;

    @ApiProperty({ description: 'Part order (number)' })
    @IsNumber()
    readonly partOrder: number;

    @ApiProperty({ description: 'Recording start timestamp (ms since epoch)' })
    @IsNumber()
    readonly startTimestamp: number;
}
