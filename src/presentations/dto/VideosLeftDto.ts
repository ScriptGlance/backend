export class VideosLeftDto {
    user_id: number;
    videos_left: number | null;

    constructor(user_id: number, videos_left: number | null) {
        this.user_id = user_id;
        this.videos_left = videos_left;
    }
}