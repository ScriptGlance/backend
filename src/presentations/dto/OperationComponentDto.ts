import {
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';
import { TextOperationType } from '../../common/enum/TextOperationType';

export class OperationComponentDto {
  @IsEnum(TextOperationType)
  type: TextOperationType;

  @IsOptional()
  @IsInt()
  @IsPositive()
  count?: number;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsInt()
  userId?: number;
}
