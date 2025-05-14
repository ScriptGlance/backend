export class RecordedVideosCountChangeEventDto {
    user_id: number;
    recorded_videos_count: number;

    constructor(user_id: number, recorded_videos_count: number) {
        this.user_id = user_id;
        this.recorded_videos_count = recorded_videos_count;
    }
}