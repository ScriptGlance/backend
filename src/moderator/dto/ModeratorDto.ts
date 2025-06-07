import { ApiProperty } from '@nestjs/swagger';

export class ModeratorDto {
  @ApiProperty({ description: 'Moderator ID' })
  moderator_id: number;

  @ApiProperty({ description: 'First name' })
  first_name: string;

  @ApiProperty({ description: 'Last name' })
  last_name: string;

  @ApiProperty({ description: 'Email' })
  email: string;

  @ApiProperty({ description: 'Joined at' })
  joined_at: Date;

  @ApiProperty({
    description: 'Avatar URL',
    nullable: true,
    example: 'https://cdn.example.com/avatars/42.png',
  })
  avatar?: string | null;

  @ApiProperty({
    description: 'Is temporary password',
  })
  is_temporary_password: boolean;
}
