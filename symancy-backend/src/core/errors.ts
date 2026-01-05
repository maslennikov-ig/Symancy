/**
 * Centralized Error Response Utilities
 *
 * Provides standardized error response format for all API endpoints.
 * Follows Fastify best practices for error handling.
 *
 * @module core/errors
 */

/**
 * Standard error response structure
 */
export interface ErrorResponse {
  error: string;
  message: string;
  details?: unknown;
}

/**
 * Common error codes used across the API
 */
export const ErrorCodes = {
  // Authentication & Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',

  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_FIELD: 'MISSING_FIELD',

  // Resources
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',

  // Server
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // Business Logic
  INSUFFICIENT_CREDITS: 'INSUFFICIENT_CREDITS',
  FEATURE_DISABLED: 'FEATURE_DISABLED',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Create a standardized error response object
 *
 * @param code - Error code from ErrorCodes enum
 * @param message - Human-readable error message
 * @param details - Optional additional details (validation errors, etc.)
 * @returns Standardized error response object
 *
 * @example
 * ```typescript
 * // Simple error
 * return reply.status(401).send(
 *   createErrorResponse('UNAUTHORIZED', 'Missing or invalid authorization header')
 * );
 *
 * // With details
 * return reply.status(400).send(
 *   createErrorResponse('VALIDATION_ERROR', 'Invalid input', { field: 'timezone', issue: 'too long' })
 * );
 * ```
 */
export function createErrorResponse(
  code: ErrorCode | string,
  message: string,
  details?: unknown
): ErrorResponse {
  const response: ErrorResponse = {
    error: code,
    message,
  };

  if (details !== undefined) {
    response.details = details;
  }

  return response;
}

/**
 * HTTP status codes for common errors
 */
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * Custom API Error class for throwing typed errors
 *
 * @example
 * ```typescript
 * throw new ApiError(401, 'UNAUTHORIZED', 'Token expired');
 * ```
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode | string;
  public readonly details?: unknown;

  constructor(
    statusCode: number,
    code: ErrorCode | string,
    message: string,
    details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  /**
   * Convert to error response format
   */
  toResponse(): ErrorResponse {
    return createErrorResponse(this.code, this.message, this.details);
  }
}
