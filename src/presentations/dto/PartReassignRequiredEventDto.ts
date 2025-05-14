import {PartReassignReason} from "../../common/enum/PartReassignReason";

export class PartReassignRequiredEventDto {
    part_id: number;
    part_reassign_reason: PartReassignReason;

    constructor(part_id: number, part_reassign_reason: PartReassignReason) {
        this.part_id = part_id;
        this.part_reassign_reason = part_reassign_reason;
    }
}