import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface PostgresError {
  code?: string;
  detail?: string;
  message?: string;
  driverError?: {
    code?: string;
    detail?: string;
    message?: string;
  };
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null &&
        'message' in exceptionResponse
      ) {
        const rawMessage = (exceptionResponse as { message: unknown }).message;
        if (Array.isArray(rawMessage)) {
          message = rawMessage.join(', ');
        } else if (typeof rawMessage === 'string') {
          message = rawMessage;
        }
      }
    } else if (typeof exception === 'object' && exception !== null) {
      const pgErr = exception as PostgresError;
      const pgCode = pgErr.code ?? pgErr.driverError?.code;
      const pgDetail =
        pgErr.detail ??
        pgErr.driverError?.detail ??
        pgErr.message ??
        pgErr.driverError?.message;

      if (pgCode === '23505') {
        statusCode = HttpStatus.CONFLICT;
        message = pgDetail
          ? `Duplicate value violates unique constraint: ${pgDetail}`
          : 'Duplicate value violates unique constraint';
      } else if (pgCode === '23503') {
        statusCode = HttpStatus.CONFLICT;
        message = pgDetail
          ? `Foreign key constraint violation: ${pgDetail}`
          : 'Resource cannot be modified or deleted because it is referenced by other records';
      } else if (pgCode === '23514') {
        statusCode = HttpStatus.BAD_REQUEST;
        message = pgDetail
          ? `Check constraint violation: ${pgDetail}`
          : 'Data violates domain check constraint';
      } else if (pgCode === '22P02') {
        statusCode = HttpStatus.BAD_REQUEST;
        message = 'Invalid input syntax for type (e.g., malformed UUID or number)';
      } else if (exception instanceof Error && exception.message) {
        message = exception.message;
      }
    }

    response.status(statusCode).json({
      success: false,
      statusCode,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
