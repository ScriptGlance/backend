import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

export class PartCreateDto {
  @ApiProperty()
  @IsInt()
  part_order: number;
}
