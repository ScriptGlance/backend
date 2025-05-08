import {ActivePresentationDto} from "./ActivePresentationDto";

export class ActivePresentationWithUsersDto {
    activePresentation: ActivePresentationDto;
    joinedUserIds: number[];
}