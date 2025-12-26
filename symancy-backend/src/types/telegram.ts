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
 * Job data types
 * Re-exported from job-schemas for backwards compatibility
 */
export type {
  PhotoAnalysisJobData,
  ChatReplyJobData,
  SendMessageJobData,
  EngagementJobData,
} from "./job-schemas.js";
