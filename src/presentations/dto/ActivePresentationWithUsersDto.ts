import {ActivePresentationDto} from "./ActivePresentationDto";
import {JoinedUserDto} from "./JoinedUserDto";

export class ActivePresentationWithUsersDto extends ActivePresentationDto {
    joinedUsers: JoinedUserDto[];
}