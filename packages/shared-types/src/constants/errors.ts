/**
 * Omnichannel Chat Error Codes
 *
 * Standard error codes and types for API responses.
 * Use these codes for consistent error handling across frontend and backend.
 *
 * @example
 * ```typescript
 * import { ErrorCodes, ApiError } from '@symancy/shared-types';
 *
 * // Backend - return typed error
 * const error: ApiError = {
 *   error: ErrorCodes.INSUFFICIENT_CREDITS,
 *   message: 'Not enough credits for this operation',
 *   details: { required: 10, available: 5 }
 * };
 *
 * // Frontend - handle specific error codes
 * if (response.error === ErrorCodes.INSUFFICIENT_CREDITS) {
 *   showPaymentModal();
 * }
 * ```
 */

// =============================================================================
// ERROR TYPES
// =============================================================================

/**
 * Standard error codes for API responses.
 *
 * Grouped by category:
 * - **Auth errors**: Authentication and authorization failures
 * - **Validation errors**: Invalid request data
 * - **Resource errors**: Entity not found
 * - **Business logic errors**: Domain rule violations
 * - **Delivery errors**: Message delivery failures
 *
 * @example
 * ```typescript
 * // Check for auth error
 * if (error === ErrorCodes.UNAUTHORIZED) {
 *   redirectToLogin();
 * }
 *
 * // Check for resource error
 * if (error === ErrorCodes.USER_NOT_FOUND) {
 *   showUserNotFoundMessage();
 * }
 * ```
 */
export const ErrorCodes = {
  /** Invalid HMAC signature in Telegram auth data */
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  /** Auth data has expired (>24h for Telegram) */
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  /** Missing or invalid authorization token */
  UNAUTHORIZED: 'UNAUTHORIZED',

  /** Request payload failed validation */
  INVALID_REQUEST: 'INVALID_REQUEST',
  /** Required field is missing from request */
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',

  /** User with given ID not found */
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  /** Conversation with given ID not found */
  CONVERSATION_NOT_FOUND: 'CONVERSATION_NOT_FOUND',
  /** Message with given ID not found */
  MESSAGE_NOT_FOUND: 'MESSAGE_NOT_FOUND',

  /** User doesn't have enough credits for operation */
  INSUFFICIENT_CREDITS: 'INSUFFICIENT_CREDITS',
  /** Too many requests, rate limit exceeded */
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  /** User account is banned */
  USER_BANNED: 'USER_BANNED',
  /** Link token has expired */
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  /** Link token was already used */
  TOKEN_ALREADY_USED: 'TOKEN_ALREADY_USED',
  /** Account is already linked to another user */
  ACCOUNT_ALREADY_LINKED: 'ACCOUNT_ALREADY_LINKED',

  /** Message delivery failed (general) */
  DELIVERY_FAILED: 'DELIVERY_FAILED',
  /** User has blocked the Telegram bot */
  USER_BLOCKED_BOT: 'USER_BLOCKED_BOT',
  /** User has no messenger channel for delivery */
  NO_MESSENGER_CHANNEL: 'NO_MESSENGER_CHANNEL',
} as const;

/**
 * Union type of all valid error codes.
 *
 * @example
 * ```typescript
 * function handleError(code: ErrorCode) {
 *   switch (code) {
 *     case ErrorCodes.UNAUTHORIZED:
 *       return redirectToLogin();
 *     case ErrorCodes.INSUFFICIENT_CREDITS:
 *       return showPaymentModal();
 *     default:
 *       return showGenericError();
 *   }
 * }
 * ```
 */
export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Typed API error response structure.
 *
 * @example
 * ```typescript
 * // Creating an error response
 * const error: ApiError = {
 *   error: ErrorCodes.INVALID_REQUEST,
 *   message: 'Invalid message content',
 *   details: { field: 'content', reason: 'Content cannot be empty' }
 * };
 *
 * // Handling an error response
 * try {
 *   await sendMessage(data);
 * } catch (err) {
 *   const apiError = err as ApiError;
 *   console.error(`Error ${apiError.error}: ${apiError.message}`);
 * }
 * ```
 */
export interface ApiError {
  /** Error code from ErrorCodes constant */
  error: ErrorCode;
  /** Human-readable error message */
  message: string;
  /** Optional additional error details */
  details?: Record<string, unknown>;
}
