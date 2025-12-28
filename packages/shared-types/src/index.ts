/**
 * @symancy/shared-types
 *
 * Shared TypeScript types and Zod schemas for Symancy frontend and backend.
 * Single source of truth for all omnichannel types.
 *
 * @packageDocumentation
 *
 * @example
 * ```typescript
 * // Backend - use Zod schemas for validation
 * import { UnifiedUserSchema, SendMessageRequestSchema } from '@symancy/shared-types';
 * const user = UnifiedUserSchema.parse(data);
 *
 * // Frontend - use pure types for type-checking
 * import type { UnifiedUser, Message } from '@symancy/shared-types';
 * const user: UnifiedUser = await fetchUser();
 *
 * // Both - use type guards
 * import { isValidTelegramAuth } from '@symancy/shared-types';
 * if (isValidTelegramAuth(data)) { ... }
 * ```
 */

/**
 * Zod enum schemas for channel types, message status, etc.
 * @see {@link ChannelSchema} - Supported communication channels
 * @see {@link InterfaceSchema} - UI interfaces (web, telegram, etc.)
 * @see {@link MessageStatusSchema} - Message delivery statuses
 */
export * from './schemas/enums.js';

/**
 * Zod schemas for domain entities (users, messages, conversations).
 * @see {@link UnifiedUserSchema} - User entity with all channels
 * @see {@link MessageSchema} - Chat message
 * @see {@link ConversationSchema} - Chat conversation
 */
export * from './schemas/entities.js';

/**
 * Zod schemas for API request/response payloads.
 * @see {@link SendMessageRequestSchema} - Send message request
 * @see {@link TelegramAuthDataSchema} - Telegram Login Widget auth data
 */
export * from './schemas/requests.js';

/**
 * Runtime type guard functions using Zod validation.
 * @see {@link isValidTelegramAuth} - Validates Telegram auth payload
 * @see {@link isValidUnifiedUser} - Validates user entity
 */
export * from './guards/index.js';

/**
 * Error codes and API error types for consistent error handling.
 * @see {@link ErrorCodes} - Standard error code constants
 * @see {@link ApiError} - Typed API error interface
 */
export * from './constants/errors.js';
