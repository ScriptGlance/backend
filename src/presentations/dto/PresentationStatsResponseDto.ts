import { ApiProperty } from '@nestjs/swagger';

export class PresentationStatsResponseDto {
  @ApiProperty({ description: 'Total presentations owned' })
  presentation_count: number;

  @ApiProperty({ description: 'Unique invited participants' })
  invited_participants: number;

  @ApiProperty({ description: 'Number of recordings made' })
  recordings_made: number;
}
