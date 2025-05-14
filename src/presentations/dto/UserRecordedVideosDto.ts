export class UserRecordedVideosDto {
    userId: number;
    recordedVideosCount: number;

    constructor(userId: number, recordedVideosCount: number) {
        this.userId = userId;
        this.recordedVideosCount = recordedVideosCount;
    }
}