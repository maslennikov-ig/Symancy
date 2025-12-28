/**
 * Omnichannel Chat Types
 *
 * TypeScript types for the frontend omnichannel chat feature.
 * Backend uses Zod schemas for validation; frontend uses pure types.
 */

// =============================================================================
// ENUMERATIONS
// =============================================================================

/**
 * Communication channels (identity sources)
 */
export type ChannelType = 'telegram' | 'web' | 'whatsapp' | 'wechat';

/**
 * Interface types (delivery methods within a channel)
 */
export type InterfaceType = 'bot' | 'webapp' | 'browser' | 'api' | 'miniprogram';

/**
 * Message roles
 */
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * Content types for messages
 */
export type ContentType = 'text' | 'image' | 'analysis' | 'audio' | 'document';

/**
 * Message processing status
 */
export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Message delivery status
 */
export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

/**
 * Conversation status
 */
export type ConversationStatus = 'active' | 'archived' | 'deleted';

/**
 * AI persona types
 */
export type Persona = 'arina' | 'cassandra';

/**
 * Supported language codes
 */
export type LanguageCode = 'ru' | 'en' | 'zh';

// =============================================================================
// ENTITY TYPES
// =============================================================================

/**
 * Unified User - Core identity entity
 */
export interface UnifiedUser {
  id: string;
  telegram_id: number | null;
  auth_id: string | null;
  whatsapp_phone: string | null;
  wechat_openid: string | null;
  display_name: string | null;
  avatar_url: string | null;
  language_code: LanguageCode;
  timezone: string;
  is_telegram_linked: boolean;
  onboarding_completed: boolean;
  is_banned: boolean;
  primary_interface: InterfaceType;
  notification_settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  last_active_at: string;
}

/**
 * User Credits - Credit balance entity
 */
export interface UserCredits {
  id: string;
  unified_user_id: string;
  credits_basic: number;
  credits_pro: number;
  credits_cassandra: number;
  created_at: string;
  updated_at: string;
}

/**
 * Conversation - Chat session entity
 */
export interface Conversation {
  id: string;
  unified_user_id: string;
  persona: Persona;
  status: ConversationStatus;
  context: Record<string, unknown>;
  summary: string | null;
  message_count: number;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
}

/**
 * Message - Individual message entity
 */
export interface Message {
  id: string;
  conversation_id: string;
  channel: ChannelType;
  interface: InterfaceType;
  role: MessageRole;
  content: string;
  content_type: ContentType;
  reply_to_message_id: string | null;
  metadata: Record<string, unknown>;
  processing_status: ProcessingStatus;
  created_at: string;
}

/**
 * Message Delivery - Delivery tracking entity
 */
export interface MessageDelivery {
  id: string;
  message_id: string;
  target_channel: ChannelType;
  target_interface: InterfaceType;
  status: DeliveryStatus;
  external_message_id: string | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
  sent_at: string | null;
  delivered_at: string | null;
}

/**
 * Link Token - Account linking entity
 */
export interface LinkToken {
  id: string;
  unified_user_id: string;
  token: string;
  source_channel: ChannelType;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

// =============================================================================
// REQUEST/RESPONSE TYPES
// =============================================================================

/**
 * Telegram Login Widget Auth Data
 */
export interface TelegramAuthData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

/**
 * Telegram WebApp initData parsed user
 */
export interface WebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

/**
 * Telegram WebApp initData
 */
export interface WebAppInitData {
  query_id?: string;
  user?: WebAppUser;
  auth_date: number;
  hash: string;
}

/**
 * Send Message Request
 */
export interface SendMessageRequest {
  conversation_id?: string;
  content: string;
  interface: 'webapp' | 'browser';
  content_type?: ContentType;
  temp_id?: string;
  persona?: Persona;
}

/**
 * Auth Response
 */
export interface AuthResponse {
  user: UnifiedUser;
  token: string;
  expires_at: string;
}

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

const CHANNELS: ChannelType[] = ['telegram', 'web', 'whatsapp', 'wechat'];
const INTERFACES: InterfaceType[] = ['bot', 'webapp', 'browser', 'api', 'miniprogram'];

export function isChannel(value: unknown): value is ChannelType {
  return typeof value === 'string' && CHANNELS.includes(value as ChannelType);
}

export function isInterface(value: unknown): value is InterfaceType {
  return typeof value === 'string' && INTERFACES.includes(value as InterfaceType);
}

export function isValidTelegramAuth(data: unknown): data is TelegramAuthData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.id === 'number' &&
    typeof d.first_name === 'string' &&
    typeof d.auth_date === 'number' &&
    typeof d.hash === 'string'
  );
}

export function isValidSendMessageRequest(data: unknown): data is SendMessageRequest {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.content === 'string' &&
    d.content.length > 0 &&
    d.content.length <= 10000 &&
    (d.interface === 'webapp' || d.interface === 'browser')
  );
}
