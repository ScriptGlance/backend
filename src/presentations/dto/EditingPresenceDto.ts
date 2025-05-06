import {PresenceEventType} from "../../common/enum/PresenceEventType";

export class EditingPresenceDto {
    user_id: number;
    type: PresenceEventType;

    constructor(user_id: number, type: PresenceEventType) {
        this.user_id = user_id;
        this.type = type;
    }
}