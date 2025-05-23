import { ApiProperty } from '@nestjs/swagger';

export class TokenResponseDto {
  @ApiProperty()
  token: string;

  constructor(token: string) {
    this.token = token;
  }
}
