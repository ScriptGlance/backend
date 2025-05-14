import {PresentationEventType} from "../../common/enum/PresentationEventType";

export class PresentationEventDto {
    event_type: PresentationEventType;

    constructor(event_type: PresentationEventType) {
        this.event_type = event_type;
    }
}
