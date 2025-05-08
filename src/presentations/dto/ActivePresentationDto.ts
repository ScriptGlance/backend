import {PartStructureDto} from "./PartStructureDto";
import {SessionReadingPositionDto} from "./SessionReadingPositionDto";

export class ActivePresentationDto {
    currentReadingPosition: SessionReadingPositionDto;
    structure: PartStructureDto[];

    constructor(
        currentReadingPosition: SessionReadingPositionDto,
        structure: PartStructureDto[],
    ) {
        this.currentReadingPosition = currentReadingPosition;
        this.structure = structure;
    }
}