import {UserDto} from "./UserDto";

export class VideoDto {
    video_id: number;
    video_thumbnail: string;
    video_duration: number;
    video_title: string;
    video_author: UserDto;
}