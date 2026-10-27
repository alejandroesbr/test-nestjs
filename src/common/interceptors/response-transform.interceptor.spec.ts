import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, firstValueFrom } from 'rxjs';
import { ResponseTransformInterceptor } from './response-transform.interceptor.js';

describe('ResponseTransformInterceptor', () => {
  let interceptor: ResponseTransformInterceptor<unknown>;

  beforeEach(() => {
    interceptor = new ResponseTransformInterceptor();
  });

  const createMockContext = (statusCode = 200): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getResponse: () => ({ statusCode }),
      }),
    }) as unknown as ExecutionContext;

  it('wraps payload in standard response format with dynamic statusCode and ISO timestamp', async () => {
    const context = createMockContext(201);
    const next: CallHandler = {
      handle: () => of({ id: '123', plate: 'ABC-123' }),
    };

    const result = await firstValueFrom(interceptor.intercept(context, next));

    expect(result).toEqual({
      success: true,
      statusCode: 201,
      data: { id: '123', plate: 'ABC-123' },
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
    });
  });

  it('returns empty object {} for data when handler returns null or undefined', async () => {
    const context = createMockContext(200);
    const nextNull: CallHandler = { handle: () => of(null) };
    const nextUndefined: CallHandler = { handle: () => of(undefined) };

    const resNull = await firstValueFrom(
      interceptor.intercept(context, nextNull),
    );
    const resUndefined = await firstValueFrom(
      interceptor.intercept(context, nextUndefined),
    );

    expect(resNull.data).toEqual({});
    expect(resUndefined.data).toEqual({});
  });
});

