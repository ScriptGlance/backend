import {PartStructureDto} from "./PartStructureDto";
import {SessionReadingPositionDto} from "./SessionReadingPositionDto";

export class ActivePresentationDto {
    currentReadingPosition: SessionReadingPositionDto;
    structure: PartStructureDto[];
    currentOwnerUserId: number;
    currentPresentationStartDate?: Date;

    constructor(
        currentReadingPosition: SessionReadingPositionDto,
        structure: PartStructureDto[],
        currentOwnerUserId: number,
        currentPresentationStartDate?: Date,
    ) {
        this.currentReadingPosition = currentReadingPosition;
        this.structure = structure;
        this.currentOwnerUserId = currentOwnerUserId;
        this.currentPresentationStartDate = currentPresentationStartDate;
    }
}