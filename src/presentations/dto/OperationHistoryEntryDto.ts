import { OperationComponentDto } from './OperationComponentDto';

export class OperationHistoryEntryDto {
  version: number;
  ops: OperationComponentDto[];
}
