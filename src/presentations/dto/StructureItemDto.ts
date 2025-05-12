import { ApiProperty } from '@nestjs/swagger';
import { UserDto } from '../../user/dto/UserDto';

export class StructureItemDto {
  @ApiProperty()
  part_name: string;
  @ApiProperty()
  part_order: number;
  @ApiProperty()
  words_count: number;
  @ApiProperty()
  text_preview: string;
  @ApiProperty()
  assignee?: UserDto;
}
