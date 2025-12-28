/**
 * Omnichannel Chat Entity Schemas
 *
 * Database entity schemas and types.
 */

import { z } from 'zod';
import {
  ChannelSchema,
  InterfaceSchema,
  MessageRoleSchema,
  ContentTypeSchema,
  ProcessingStatusSchema,
  DeliveryStatusSchema,
  ConversationStatusSchema,
  PersonaSchema,
  LanguageCodeSchema,
} from './enums.js';

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
 * User Credits - Credit balance entity (legacy, linked to unified_users)
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
 * Unified User Credits - New credit balance entity for omnichannel
 * Matches unified_user_credits table schema
 */
export const UnifiedUserCreditsSchema = z.object({
  id: z.string().uuid(),
  unified_user_id: z.string().uuid(),
  credits_basic: z.number().int().nonnegative().default(0),
  credits_pro: z.number().int().nonnegative().default(0),
  credits_cassandra: z.number().int().nonnegative().default(0),
  free_credit_granted: z.boolean().default(false),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type UnifiedUserCredits = z.infer<typeof UnifiedUserCreditsSchema>;

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
