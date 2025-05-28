import { PartReassignReason } from '../../common/enum/PartReassignReason';

export class PartReassignRequiredEventDto {
  part_id: number;
  user_id: number;
  part_reassign_reason: PartReassignReason;
}
