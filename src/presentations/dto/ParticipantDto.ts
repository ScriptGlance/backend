import { ApiProperty } from '@nestjs/swagger';
import { UserDto } from './UserDto';

export class ParticipantDto {
  @ApiProperty({
    description: 'Unique identifier for this participant',
  })
  participant_id: number;

  @ApiProperty({ description: 'Hex color code for this participant’s display' })
  color: string;

  @ApiProperty({ type: () => UserDto, description: 'User details' })
  user: UserDto;
}
