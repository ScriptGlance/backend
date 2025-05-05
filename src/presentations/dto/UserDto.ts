import { ApiProperty } from '@nestjs/swagger';

export class UserDto {
  @ApiProperty({ description: 'User ID' })
  user_id: number;

  @ApiProperty({ description: 'First name' })
  name: string;

  @ApiProperty({ description: 'Last name' })
  surname: string;

  @ApiProperty({
    description: 'Avatar URL',
    nullable: true,
    example: 'https://cdn.example.com/avatars/42.png',
  })
  avatar?: string | null;

  @ApiProperty({ description: 'Whether user has premium access' })
  has_premium?: boolean;
}
