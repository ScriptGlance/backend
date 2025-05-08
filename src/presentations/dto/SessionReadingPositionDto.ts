export class SessionReadingPositionDto {
    partId: number;
    position: number;

    constructor(partId: number, position: number) {
        this.partId = partId;
        this.position = position;
    }
}