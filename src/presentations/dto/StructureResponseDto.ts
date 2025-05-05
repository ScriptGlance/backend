import { StructureItemDto } from './StructureItemDto';
import { ApiProperty } from '@nestjs/swagger';

export class StructureResponseDto {
  @ApiProperty()
  total_words_count: number;
  @ApiProperty()
  structure: StructureItemDto[];
}
