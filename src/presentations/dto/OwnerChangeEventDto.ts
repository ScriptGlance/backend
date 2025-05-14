export class OwnerChangeEventDto {
    current_owner_change_id: number;

    constructor(current_owner_change_id: number) {
        this.current_owner_change_id = current_owner_change_id;
    }
}