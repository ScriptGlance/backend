export class RecordingModeChangeDto {
    user_id: number;
    is_recording_mode_active: boolean;

    constructor(user_id: number, is_recording_mode_active: boolean) {
        this.user_id = user_id;
        this.is_recording_mode_active = is_recording_mode_active;
    }

}