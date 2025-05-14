import { PartTarget } from '../../common/enum/PartTarget';

export class CursorPositionDto {
  user_id: number;
  part_id?: number;
  cursor_position?: number;
  target?: PartTarget;
  selection_anchor_position?: number;

  constructor(
    user_id: number,
    part_id?: number,
    cursor_position?: number,
    target?: PartTarget,
    selection_anchor_position?: number,
  ) {
    this.user_id = user_id;
    this.part_id = part_id;
    this.cursor_position = cursor_position;
    this.target = target;
    this.selection_anchor_position = selection_anchor_position;
  }
}
