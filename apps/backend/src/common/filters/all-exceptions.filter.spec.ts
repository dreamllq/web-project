import {
  HttpException,
  HttpStatus,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { ErrorResponse } from '../interfaces/error-response.interface';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  const mockResponse = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };

  const mockRequest = {
    url: '/api/test',
    method: 'GET',
  };

  const mockHost = {
    switchToHttp: jest.fn().mockReturnValue({
      getResponse: () => mockResponse,
      getRequest: () => mockRequest,
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    filter = new AllExceptionsFilter();
  });

  describe('HTTP Exceptions', () => {
    it('should handle UnauthorizedException (401)', () => {
      const exception = new UnauthorizedException('Invalid credentials');

      filter.catch(exception, mockHost as any);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.UNAUTHORIZED,
          message: 'Invalid credentials',
          error: 'Unauthorized',
          path: '/api/test',
        })
      );
    });

    it('should handle BadRequestException (400)', () => {
      const exception = new BadRequestException('Invalid input data');

      filter.catch(exception, mockHost as any);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Invalid input data',
          error: 'Bad Request',
          path: '/api/test',
        })
      );
    });

    it('should handle ForbiddenException (403)', () => {
      const exception = new ForbiddenException('Access denied');

      filter.catch(exception, mockHost as any);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.FORBIDDEN,
          message: 'Access denied',
          error: 'Forbidden',
          path: '/api/test',
        })
      );
    });

    it('should handle NotFoundException (404)', () => {
      const exception = new NotFoundException('Resource not found');

      filter.catch(exception, mockHost as any);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Resource not found',
          error: 'Not Found',
          path: '/api/test',
        })
      );
    });

    it('should handle InternalServerErrorException (500)', () => {
      const exception = new InternalServerErrorException('Something went wrong');

      filter.catch(exception, mockHost as any);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Something went wrong',
          error: 'Internal Server Error',
          path: '/api/test',
        })
      );
    });

    it('should handle HttpException with object response', () => {
      const exception = new HttpException(
        {
          statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          message: 'Validation failed',
          error: 'UnprocessableEntity',
        },
        HttpStatus.UNPROCESSABLE_ENTITY
      );

      filter.catch(exception, mockHost as any);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          message: 'Validation failed',
          error: 'UnprocessableEntity',
        })
      );
    });

    it('should handle HttpException with array messages', () => {
      const exception = new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          message: ['Field A is required', 'Field B is invalid'],
          error: 'BadRequest',
        },
        HttpStatus.BAD_REQUEST
      );

      filter.catch(exception, mockHost as any);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Field A is required, Field B is invalid',
        })
      );
    });
  });

  describe('Generic Errors', () => {
    it('should handle generic Error with 500 status', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const exception = new Error('Something unexpected happened');

      filter.catch(exception, mockHost as any);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Something unexpected happened',
          error: 'Error',
          path: '/api/test',
        })
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should hide error details in production for generic errors', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      // Create new filter instance to pick up production env
      const productionFilter = new AllExceptionsFilter();
      const exception = new Error('Database connection string with password=secret');

      productionFilter.catch(exception, mockHost as any);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
          error: 'InternalServerError',
        })
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Unknown Exceptions', () => {
    it('should handle unknown exception types', () => {
      const exception = 'Some string exception';

      filter.catch(exception, mockHost as any);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'An unexpected error occurred',
          error: 'UnknownError',
        })
      );
    });

    it('should handle null exception', () => {
      filter.catch(null, mockHost as any);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'An unexpected error occurred',
          error: 'UnknownError',
        })
      );
    });

    it('should handle undefined exception', () => {
      filter.catch(undefined, mockHost as any);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'An unexpected error occurred',
          error: 'UnknownError',
        })
      );
    });
  });

  describe('Response Format', () => {
    it('should include timestamp in ISO format', () => {
      const exception = new BadRequestException('Test');

      filter.catch(exception, mockHost as any);

      const callArgs = mockResponse.json.mock.calls[0][0] as ErrorResponse;
      expect(callArgs.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    });

    it('should include request path', () => {
      const exception = new BadRequestException('Test');

      filter.catch(exception, mockHost as any);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          path: '/api/test',
        })
      );
    });
  });

  describe('Sensitive Data Protection', () => {
    it('should mask sensitive information in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const productionFilter = new AllExceptionsFilter();
      const exception = new HttpException(
        'Error with token=abc123 and password=secret123',
        HttpStatus.BAD_REQUEST
      );

      productionFilter.catch(exception, mockHost as any);

      const callArgs = mockResponse.json.mock.calls[0][0] as ErrorResponse;
      expect(callArgs.message).toContain('[REDACTED]');
      expect(callArgs.message).not.toContain('abc123');
      expect(callArgs.message).not.toContain('secret123');

      process.env.NODE_ENV = originalEnv;
    });

    it('should not mask information in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const devFilter = new AllExceptionsFilter();
      const exception = new HttpException(
        'Error with token=abc123 and password=secret123',
        HttpStatus.BAD_REQUEST
      );

      devFilter.catch(exception, mockHost as any);

      const callArgs = mockResponse.json.mock.calls[0][0] as ErrorResponse;
      expect(callArgs.message).toContain('token=abc123');
      expect(callArgs.message).toContain('password=secret123');

      process.env.NODE_ENV = originalEnv;
    });
  });
});
