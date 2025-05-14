export class JoinedUserDto {
    userId: number;
    isRecordingModeActive: boolean;

    constructor(userId: number, isRecordingModeActive: boolean = false) {
        this.userId = userId;
        this.isRecordingModeActive = isRecordingModeActive;
    }
}