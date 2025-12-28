/**
 * Omnichannel Chat Request/Response Schemas
 *
 * API request and response schemas, plus additional interface types.
 */

import { z } from 'zod';
import { ContentTypeSchema, PersonaSchema } from './enums.js';
import type { ChannelType, InterfaceType } from './enums.js';
import { UnifiedUserSchema } from './entities.js';
import type { Message } from './entities.js';

// =============================================================================
// REQUEST/RESPONSE SCHEMAS
// =============================================================================

/**
 * Telegram Login Widget Auth Data
 *
 * Enhanced validation with:
 * - Maximum field lengths (prevents DoS)
 * - Username format validation (Telegram format)
 * - Photo URL domain validation (SSRF protection)
 * - Hash format validation (SHA256 hex)
 */
export const TelegramAuthDataSchema = z.object({
  id: z.number().int().positive(),
  first_name: z.string().min(1).max(64),  // Telegram's max
  last_name: z.string().max(64).optional(),
  username: z.string()
    .max(32)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username must only contain letters, numbers, and underscores')
    .optional(),
  photo_url: z.string()
    .url()
    .max(256)
    .refine((url) => {
      try {
        const hostname = new URL(url).hostname;
        return hostname.endsWith('telegram.org') || hostname.endsWith('t.me');
      } catch {
        return false;
      }
    }, 'Photo URL must be from telegram.org or t.me')
    .optional(),
  auth_date: z.number().int().positive()
    .refine((date) => {
      const now = Math.floor(Date.now() / 1000);
      // Allow 60s clock skew for future dates
      return date <= now + 60;
    }, 'auth_date cannot be in the future'),
  hash: z.string()
    .length(64, 'Hash must be exactly 64 characters (SHA256 hex)')
    .regex(/^[a-f0-9]+$/, 'Hash must be lowercase hex'),
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
