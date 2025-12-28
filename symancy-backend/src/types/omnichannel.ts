/**
 * Omnichannel Chat Types
 *
 * Shared TypeScript types for frontend and backend.
 * This file should be the single source of truth for omnichannel types.
 */

import { z } from 'zod';

// =============================================================================
// ENUMERATIONS
// =============================================================================

/**
 * Communication channels (identity sources)
 */
export const ChannelSchema = z.enum(['telegram', 'web', 'whatsapp', 'wechat']);
export type ChannelType = z.infer<typeof ChannelSchema>;

/**
 * Interface types (delivery methods within a channel)
 */
export const InterfaceSchema = z.enum(['bot', 'webapp', 'browser', 'api', 'miniprogram']);
export type InterfaceType = z.infer<typeof InterfaceSchema>;

/**
 * Message roles
 */
export const MessageRoleSchema = z.enum(['user', 'assistant', 'system']);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

/**
 * Content types for messages
 */
export const ContentTypeSchema = z.enum(['text', 'image', 'analysis', 'audio', 'document']);
export type ContentType = z.infer<typeof ContentTypeSchema>;

/**
 * Message processing status
 */
export const ProcessingStatusSchema = z.enum(['pending', 'processing', 'completed', 'failed']);
export type ProcessingStatus = z.infer<typeof ProcessingStatusSchema>;

/**
 * Message delivery status
 */
export const DeliveryStatusSchema = z.enum(['pending', 'sent', 'delivered', 'read', 'failed']);
export type DeliveryStatus = z.infer<typeof DeliveryStatusSchema>;

/**
 * Conversation status
 */
export const ConversationStatusSchema = z.enum(['active', 'archived', 'deleted']);
export type ConversationStatus = z.infer<typeof ConversationStatusSchema>;

/**
 * AI persona types
 */
export const PersonaSchema = z.enum(['arina', 'cassandra']);
export type Persona = z.infer<typeof PersonaSchema>;

/**
 * Supported language codes
 */
export const LanguageCodeSchema = z.enum(['ru', 'en', 'zh']);
export type LanguageCode = z.infer<typeof LanguageCodeSchema>;

// =============================================================================
// ENTITY SCHEMAS
// =============================================================================

/**
 * Unified User - Core identity entity
 */
export const UnifiedUserSchema = z.object({
  id: z.string().uuid(),
  telegram_id: z.number().int().positive().nullable(),
  auth_id: z.string().uuid().nullable(),
  whatsapp_phone: z.string().nullable(),
  wechat_openid: z.string().nullable(),
  display_name: z.string().max(255).nullable(),
  avatar_url: z.string().url().nullable(),
  language_code: LanguageCodeSchema.default('ru'),
  timezone: z.string().default('Europe/Moscow'),
  is_telegram_linked: z.boolean().default(false),
  onboarding_completed: z.boolean().default(false),
  is_banned: z.boolean().default(false),
  primary_interface: InterfaceSchema.default('bot'),
  notification_settings: z.record(z.string(), z.unknown()).default({}),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  last_active_at: z.string().datetime(),
});

export type UnifiedUser = z.infer<typeof UnifiedUserSchema>;

/**
 * User Credits - Credit balance entity
 */
export const UserCreditsSchema = z.object({
  id: z.string().uuid(),
  unified_user_id: z.string().uuid(),
  credits_basic: z.number().int().nonnegative().default(0),
  credits_pro: z.number().int().nonnegative().default(0),
  credits_cassandra: z.number().int().nonnegative().default(0),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type UserCredits = z.infer<typeof UserCreditsSchema>;

/**
 * Conversation - Chat session entity
 */
export const ConversationSchema = z.object({
  id: z.string().uuid(),
  unified_user_id: z.string().uuid(),
  persona: PersonaSchema.default('arina'),
  status: ConversationStatusSchema.default('active'),
  context: z.record(z.string(), z.unknown()).default({}),
  summary: z.string().nullable(),
  message_count: z.number().int().nonnegative().default(0),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  last_message_at: z.string().datetime().nullable(),
});

export type Conversation = z.infer<typeof ConversationSchema>;

/**
 * Message - Individual message entity
 */
export const MessageSchema = z.object({
  id: z.string().uuid(),
  conversation_id: z.string().uuid(),
  channel: ChannelSchema,
  interface: InterfaceSchema,
  role: MessageRoleSchema,
  content: z.string().min(1).max(10000),
  content_type: ContentTypeSchema.default('text'),
  reply_to_message_id: z.string().uuid().nullable(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  processing_status: ProcessingStatusSchema.default('completed'),
  created_at: z.string().datetime(),
});

export type Message = z.infer<typeof MessageSchema>;

/**
 * Message Delivery - Delivery tracking entity
 */
export const MessageDeliverySchema = z.object({
  id: z.string().uuid(),
  message_id: z.string().uuid(),
  target_channel: ChannelSchema,
  target_interface: InterfaceSchema,
  status: DeliveryStatusSchema.default('pending'),
  external_message_id: z.string().nullable(),
  error_message: z.string().nullable(),
  retry_count: z.number().int().nonnegative().default(0),
  created_at: z.string().datetime(),
  sent_at: z.string().datetime().nullable(),
  delivered_at: z.string().datetime().nullable(),
});

export type MessageDelivery = z.infer<typeof MessageDeliverySchema>;

/**
 * Link Token - Account linking entity
 */
export const LinkTokenSchema = z.object({
  id: z.string().uuid(),
  unified_user_id: z.string().uuid(),
  token: z.string().min(32),
  source_channel: ChannelSchema,
  expires_at: z.string().datetime(),
  used_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
});

export type LinkToken = z.infer<typeof LinkTokenSchema>;

// =============================================================================
// REQUEST/RESPONSE SCHEMAS
// =============================================================================

/**
 * Telegram Login Widget Auth Data
 */
export const TelegramAuthDataSchema = z.object({
  id: z.number().int().positive(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().url().optional(),
  auth_date: z.number().int().positive(),
  hash: z.string(),
});

export type TelegramAuthData = z.infer<typeof TelegramAuthDataSchema>;

/**
 * Telegram WebApp initData parsed user
 */
export const WebAppUserSchema = z.object({
  id: z.number().int().positive(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  language_code: z.string().optional(),
  is_premium: z.boolean().optional(),
});

export type WebAppUser = z.infer<typeof WebAppUserSchema>;

/**
 * Telegram WebApp initData
 */
export const WebAppInitDataSchema = z.object({
  query_id: z.string().optional(),
  user: WebAppUserSchema.optional(),
  auth_date: z.number().int().positive(),
  hash: z.string(),
});

export type WebAppInitData = z.infer<typeof WebAppInitDataSchema>;

/**
 * Send Message Request
 */
export const SendMessageRequestSchema = z.object({
  conversation_id: z.string().uuid().optional(),
  content: z.string().min(1).max(10000),
  interface: z.enum(['webapp', 'browser']),
  content_type: ContentTypeSchema.default('text'),
  temp_id: z.string().optional(),
  persona: PersonaSchema.optional(),
});

export type SendMessageRequest = z.infer<typeof SendMessageRequestSchema>;

/**
 * Auth Response
 */
export const AuthResponseSchema = z.object({
  user: UnifiedUserSchema,
  token: z.string(),
  expires_at: z.string().datetime(),
});

export type AuthResponse = z.infer<typeof AuthResponseSchema>;

// =============================================================================
// IMAGE/PHOTO METADATA
// =============================================================================

/**
 * Metadata structure for image messages
 */
export interface ImageMessageMetadata {
  /** Telegram file_id for downloading */
  telegram_file_id?: string;
  /** Telegram unique file identifier */
  telegram_file_unique_id?: string;
  /** Public URL from Supabase Storage */
  image_url?: string;
  /** Storage path in Supabase Storage bucket */
  image_storage_path?: string;
  /** Associated analysis ID (for coffee reading images) */
  analysis_id?: string;
}

// =============================================================================
// ROUTING TYPES
// =============================================================================

/**
 * Routing context for message delivery
 */
export interface RoutingContext {
  channel: ChannelType;
  interface: InterfaceType;
  deliveryMethod: 'telegram_api' | 'realtime' | 'whatsapp_api';
}

/**
 * Delivery result
 */
export interface DeliveryResult {
  success: boolean;
  externalMessageId?: string;
  deliveredAt?: Date;
  errorMessage?: string;
}

// =============================================================================
// JWT TYPES
// =============================================================================

/**
 * Custom JWT payload for Telegram-authenticated users
 */
export interface TelegramJwtPayload {
  /** unified_users.id */
  sub: string;
  /** Telegram user ID (for logging/debugging) */
  telegram_id: number;
  /** Supabase standard role */
  role: 'authenticated';
  /** Issued at (Unix timestamp) */
  iat: number;
  /** Expiration (Unix timestamp) */
  exp: number;
}

// =============================================================================
// REALTIME TYPES
// =============================================================================

/**
 * Realtime channel subscription status
 */
export type RealtimeStatus = 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED';

/**
 * Realtime message payload (postgres_changes)
 */
export interface RealtimeMessagePayload {
  schema: string;
  table: string;
  commit_timestamp: string;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Message | null;
  old: Partial<Message> | null;
}

// =============================================================================
// ERROR TYPES
// =============================================================================

/**
 * Standard error codes
 */
export const ErrorCodes = {
  // Auth errors
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  UNAUTHORIZED: 'UNAUTHORIZED',

  // Validation errors
  INVALID_REQUEST: 'INVALID_REQUEST',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',

  // Resource errors
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  CONVERSATION_NOT_FOUND: 'CONVERSATION_NOT_FOUND',
  MESSAGE_NOT_FOUND: 'MESSAGE_NOT_FOUND',

  // Business logic errors
  INSUFFICIENT_CREDITS: 'INSUFFICIENT_CREDITS',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  USER_BANNED: 'USER_BANNED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_ALREADY_USED: 'TOKEN_ALREADY_USED',
  ACCOUNT_ALREADY_LINKED: 'ACCOUNT_ALREADY_LINKED',

  // Delivery errors
  DELIVERY_FAILED: 'DELIVERY_FAILED',
  USER_BLOCKED_BOT: 'USER_BLOCKED_BOT',
  NO_MESSENGER_CHANNEL: 'NO_MESSENGER_CHANNEL',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Typed API error
 */
export interface ApiError {
  error: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

// =============================================================================
// HELPER TYPE GUARDS
// =============================================================================

export function isChannel(value: unknown): value is ChannelType {
  return ChannelSchema.safeParse(value).success;
}

export function isInterface(value: unknown): value is InterfaceType {
  return InterfaceSchema.safeParse(value).success;
}

export function isValidTelegramAuth(data: unknown): data is TelegramAuthData {
  return TelegramAuthDataSchema.safeParse(data).success;
}

export function isValidSendMessageRequest(data: unknown): data is SendMessageRequest {
  return SendMessageRequestSchema.safeParse(data).success;
}
