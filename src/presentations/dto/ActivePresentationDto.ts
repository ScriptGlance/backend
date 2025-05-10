import {PartStructureDto} from "./PartStructureDto";
import {SessionReadingPositionDto} from "./SessionReadingPositionDto";
import {UserRecordedVideosDto} from "./UserRecordedVideosDto";

export class ActivePresentationDto {
    currentReadingPosition: SessionReadingPositionDto;
    structure: PartStructureDto[];
    currentOwnerUserId: number;
    userRecordedVideos: UserRecordedVideosDto[];
    currentPresentationStartDate?: Date;


    constructor(
        currentReadingPosition: SessionReadingPositionDto,
        structure: PartStructureDto[],
        currentOwnerUserId: number,
        userRecordedVideos: UserRecordedVideosDto[],
        currentPresentationStartDate?: Date,
    ) {
        this.currentReadingPosition = currentReadingPosition;
        this.structure = structure;
        this.currentOwnerUserId = currentOwnerUserId;
        this.userRecordedVideos = userRecordedVideos;
        this.currentPresentationStartDate = currentPresentationStartDate;
    }
}