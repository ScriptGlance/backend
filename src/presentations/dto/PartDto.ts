import { ApiProperty } from '@nestjs/swagger';

export class PartDto {
  @ApiProperty()
  part_id: number;
  @ApiProperty()
  part_name: string;
  @ApiProperty()
  part_text: string;
  @ApiProperty()
  part_order: number;
  @ApiProperty()
  assignee_participant_id?: number;
  @ApiProperty()
  part_text_version?: number;
  @ApiProperty()
  part_name_version?: number;
}
