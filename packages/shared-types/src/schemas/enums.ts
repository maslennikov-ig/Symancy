/**
 * Omnichannel Chat Enumerations
 *
 * All enum schemas and types for the omnichannel system.
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
