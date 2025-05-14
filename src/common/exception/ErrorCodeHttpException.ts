import { HttpException, HttpStatus } from '@nestjs/common';

export class ErrorCodeHttpException extends HttpException {
    public readonly errorCode: number;

    constructor(message: string, errorCode: number, status: HttpStatus = HttpStatus.BAD_REQUEST) {
        super({ message, errorCode }, status);
        this.errorCode = errorCode;
    }
}
