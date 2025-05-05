import { ApiProperty } from '@nestjs/swagger';

export class InvitationDto {
  @ApiProperty({ description: 'Unique identifier for this invitation' })
  invitation_code: string;
}
