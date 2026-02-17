import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorResponse } from '../interfaces/error-response.interface';

/**
 * Global exception filter that catches all exceptions and returns
 * a standardized error response format.
 *
 * Handles:
 * - HTTP exceptions (HttpException and subclasses)
 * - Generic errors (unknown exceptions)
 *
 * In production environment:
 * - Hides stack traces
 * - Masks sensitive error details
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);
  private readonly isProduction = process.env.NODE_ENV === 'production';

  /**
   * Sensitive field patterns to mask in production
   */
  private readonly sensitivePatterns = [
    'password',
    'token',
    'secret',
    'key',
    'credential',
    'authorization',
  ];

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, message, error } = this.extractErrorInfo(exception);

    // Log the error (with full details in development)
    this.logError(exception, statusCode, request);

    // Build error response
    const errorResponse: ErrorResponse = {
      statusCode,
      message: this.sanitizeMessage(message),
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(statusCode).json(errorResponse);
  }

  /**
   * Extract error information from different exception types
   */
  private extractErrorInfo(exception: unknown): {
    statusCode: number;
    message: string;
    error: string;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      let message: string;
      let error: string;

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = exception.name;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const response = exceptionResponse as Record<string, unknown>;
        message = this.extractMessage(response);
        error = (response.error as string) || exception.name;
      } else {
        message = exception.message;
        error = exception.name;
      }

      return { statusCode: status, message, error };
    }

    // Handle generic errors
    if (exception instanceof Error) {
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: this.isProduction ? 'Internal server error' : exception.message,
        error: this.isProduction ? 'InternalServerError' : exception.name,
      };
    }

    // Handle unknown exception types
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'An unexpected error occurred',
      error: 'UnknownError',
    };
  }

  /**
   * Extract message from exception response object
   */
  private extractMessage(response: Record<string, unknown>): string {
    if (typeof response.message === 'string') {
      return response.message;
    }

    if (Array.isArray(response.message)) {
      return response.message.join(', ');
    }

    return 'An error occurred';
  }

  /**
   * Sanitize error message to hide sensitive information in production
   */
  private sanitizeMessage(message: string): string {
    if (!this.isProduction) {
      return message;
    }

    let sanitized = message;
    for (const pattern of this.sensitivePatterns) {
      const regex = new RegExp(`(${pattern}[\\s:=]+)\\S+`, 'gi');
      sanitized = sanitized.replace(regex, '$1[REDACTED]');
    }

    return sanitized;
  }

  /**
   * Log error with appropriate detail based on environment
   */
  private logError(exception: unknown, statusCode: number, request: Request): void {
    const logContext = {
      method: request.method,
      url: request.url,
      statusCode,
      timestamp: new Date().toISOString(),
    };

    if (this.isProduction) {
      // In production, log minimal info without stack traces
      this.logger.error(
        `${request.method} ${request.url} - ${statusCode}`,
        JSON.stringify(logContext)
      );
    } else {
      // In development, log full error details
      if (exception instanceof Error) {
        this.logger.error(
          `${request.method} ${request.url} - ${statusCode}: ${exception.message}`,
          exception.stack
        );
      } else {
        this.logger.error(
          `${request.method} ${request.url} - ${statusCode}: Unknown exception`,
          JSON.stringify(exception)
        );
      }
    }
  }
}
