import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  HttpStatus,
} from '@nestjs/common';
import { jest } from '@jest/globals';
import { HttpExceptionFilter } from './http-exception.filter.js';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let mockJson: ReturnType<typeof jest.fn>;
  let mockStatus: ReturnType<typeof jest.fn>;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => ({
          status: mockStatus,
        }),
        getRequest: () => ({
          url: '/vehicles',
        }),
      }),
    } as unknown as ArgumentsHost;
  });

  it('formats standard HttpException with statusCode, message, path, and ISO timestamp', () => {
    const exception = new ConflictException('Vehicle plate already exists');

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(mockJson).toHaveBeenCalledWith({
      success: false,
      statusCode: 409,
      message: 'Vehicle plate already exists',
      path: '/vehicles',
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
    });
  });

  it('flattens array of validation messages from ValidationPipe BadRequestException', () => {
    const exception = new BadRequestException([
      'plate should not be empty',
      'mileage must not be less than 0',
    ]);

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockJson).toHaveBeenCalledWith({
      success: false,
      statusCode: 400,
      message: 'plate should not be empty, mileage must not be less than 0',
      path: '/vehicles',
      timestamp: expect.any(String),
    });
  });

  it('maps PostgreSQL 23505 unique_violation error to 409 Conflict', () => {
    const pgError = {
      code: '23505',
      detail: 'Key (plate)=(ABC-123) already exists.',
    };

    filter.catch(pgError, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(mockJson).toHaveBeenCalledWith({
      success: false,
      statusCode: 409,
      message: 'Duplicate value violates unique constraint: Key (plate)=(ABC-123) already exists.',
      path: '/vehicles',
      timestamp: expect.any(String),
    });
  });

  it('maps PostgreSQL 23503 foreign_key_violation and 23514 check_violation to 409 and 400', () => {
    const fkError = {
      driverError: {
        code: '23503',
        detail: 'Key (vehicle_id)=(...) is still referenced from table "maintenances".',
      },
    };

    filter.catch(fkError, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 409,
        path: '/vehicles',
      }),
    );

    const checkError = {
      code: '23514',
      detail: 'Failing row contains negative mileage.',
    };

    filter.catch(checkError, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 400,
        path: '/vehicles',
      }),
    );
  });
});

