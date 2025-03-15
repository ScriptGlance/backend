import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import {StandardResponse} from "../interface/StandardResponse";
import {ErrorCodeHttpException} from "../exception/ErrorCodeHttpException";

@Catch()
export class StandardResponseExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost) {
        const ctx      = host.switchToHttp();
        const response = ctx.getResponse<Response>();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'Internal server error';
        let errorCode: number | undefined = undefined;

        console.error(exception);

        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const res: any = exception.getResponse();

            if (typeof res === 'object') {
                message = res.message || message;
                if (exception instanceof ErrorCodeHttpException) {
                    errorCode = exception.errorCode;
                }

            } else {
                message = res;
            }
        }

        const standardErrorResponse: StandardResponse<any> = {
            error: true,
            description: message,
            error_code: errorCode,
        };

        response.status(status).json(standardErrorResponse);
    }
}