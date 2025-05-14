import { PartEventType } from '../../common/enum/PartEventType';

export class PartEventDto {
  event_type: PartEventType;
  part_id: number;
  part_order?: number;
  assignee_participant_id?: number;

  constructor(
    event_type: PartEventType,
    part_id: number,
    part_order?: number,
    assignee_participant_id?: number,
  ) {
    this.event_type = event_type;
    this.part_id = part_id;
    this.part_order = part_order;
    this.assignee_participant_id = assignee_participant_id;
  }
}
