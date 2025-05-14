import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional } from 'class-validator';

export class PartUpdateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  part_order?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  part_assignee_participant_id?: number;
}
