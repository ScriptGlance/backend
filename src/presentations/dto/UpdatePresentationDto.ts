import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MaxLength, IsOptional } from 'class-validator';

export class UpdatePresentationDto {
  @ApiPropertyOptional({ description: 'New presentation title' })
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  name?: string;
}
