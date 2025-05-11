import { ApiProperty } from '@nestjs/swagger';
import { UserDto } from '../../user/dto/UserDto';

export class PresentationDto {
  @ApiProperty({ description: 'Presentation ID' })
  presentation_id: number;

  @ApiProperty({ description: 'Presentation title' })
  name: string;

  @ApiProperty({ description: 'Timestamp when created' })
  created_at: Date;

  @ApiProperty({ description: 'Timestamp when last modified' })
  modified_at: Date;

  @ApiProperty({ type: () => UserDto })
  owner: UserDto;
}
