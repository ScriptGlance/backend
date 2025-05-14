export class PartReadingConfirmationRequiredEventDto {
    part_id: number;
    time_to_confirm_seconds: number;
    can_continue_from_last_position: boolean;

    constructor(part_id: number, time_to_confirm_seconds: number, can_continue_from_last_position: boolean) {
        this.part_id = part_id;
        this.time_to_confirm_seconds = time_to_confirm_seconds;
        this.can_continue_from_last_position = can_continue_from_last_position;
    }
}