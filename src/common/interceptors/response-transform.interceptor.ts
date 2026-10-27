import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface StandardResponse<T> {
  success: boolean;
  statusCode: number;
  data: T | Record<string, never>;
  timestamp: string;
}

/**
 * Interceptor global que envuelve todas las respuestas HTTP exitosas (2xx)
 * en un contrato estándar { success, statusCode, data, timestamp }.
 */
@Injectable()
export class ResponseTransformInterceptor<T>
  implements NestInterceptor<T, StandardResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<StandardResponse<T>> {
    const httpContext = context.switchToHttp();
    const response = httpContext.getResponse<Response>();

    // Transforma el flujo reactivo RxJS devuelto por el controlador antes de serializar el JSON
    return next.handle().pipe(
      map((data) => ({
        success: true,
        statusCode: response.statusCode,
        data: data ?? {},
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
