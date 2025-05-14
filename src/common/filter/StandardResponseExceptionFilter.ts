import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { StandardResponse } from '../interface/StandardResponse';
import { ErrorCodeHttpException } from '../exception/ErrorCodeHttpException';
import { ErrorWithRedirectException } from '../exception/ErrorWithRedirectException';

@Catch()
export class StandardResponseExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorCode: number | undefined = undefined;

    console.error(exception);

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res: any = exception.getResponse();

      if (typeof res === 'object' && res !== null && 'message' in res) {
        const potentialMessage = (res as { message?: unknown }).message;
        if (typeof potentialMessage === 'string') {
          message = potentialMessage;
        } else {
          message = JSON.stringify(potentialMessage);
        }
        if (exception instanceof ErrorCodeHttpException) {
          errorCode = exception.errorCode;
        }
      } else {
        message = String(res);
      }
    } else if (exception instanceof ErrorWithRedirectException) {
      response.redirect(exception.redirectUrl);
    }

    const standardErrorResponse: StandardResponse<any> = {
      error: true,
      description: message,
      error_code: errorCode,
    };

    response.status(status).json(standardErrorResponse);
  }
}
