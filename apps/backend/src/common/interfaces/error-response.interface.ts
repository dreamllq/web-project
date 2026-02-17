/**
 * Standardized error response format for all exceptions
 */
export interface ErrorResponse {
  /** HTTP status code */
  statusCode: number;

  /** Human-readable error message */
  message: string;

  /** Error type or name */
  error: string;

  /** ISO 8601 timestamp when error occurred */
  timestamp: string;

  /** Request path that caused the error */
  path: string;
}
