/**
 * Telegram-specific types for Grammy bot framework
 * Includes context extensions, message types, and job payloads
 */
import type { Context } from "grammy";
import type { Profile, UserState } from "./database.js";

/**
 * Extended context with user profile
 * Augments Grammy's Context with Symancy-specific data
 */
export interface BotContext extends Context {
  profile?: Profile;
  userState?: UserState;
}

/**
 * Message type detection result
 * Categorizes incoming Telegram messages
 */
export type MessageType = "photo" | "text" | "command" | "callback" | "unknown";

/**
 * Webhook update types we handle
 * Subset of Telegram update types processed by the bot
 */
export type HandledUpdate = "message" | "callback_query";

/**
 * Photo analysis job data
 * Payload for queued photo analysis tasks
 */
export interface PhotoAnalysisJobData {
  telegramUserId: number;
  chatId: number;
  messageId: number;  // Loading message ID to edit with result
  fileId: string;
  persona: "arina" | "cassandra";
  language: string;
  userName?: string;
}

/**
 * Chat reply job data
 * Payload for queued text message processing
 */
export interface ChatReplyJobData {
  telegramUserId: number;
  chatId: number;
  messageId: number;
  text: string;
}

/**
 * Scheduled message job data
 * Payload for scheduled proactive messages
 */
export interface SendMessageJobData {
  telegramUserId: number;
  chatId: number;
  text: string;
  parseMode?: "HTML" | "Markdown";
}
