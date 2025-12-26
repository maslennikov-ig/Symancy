/**
 * Zod schemas for pg-boss job validation
 * Ensures job data is validated before being sent to queues
 */
import { z } from "zod";

/**
 * Photo analysis job schema
 * Validates job data for photo analysis queue
 */
export const PhotoAnalysisJobSchema = z.object({
  telegramUserId: z.number().int().positive(),
  chatId: z.number().int(),
  messageId: z.number().int().positive(),
  fileId: z.string().min(1),
  persona: z.enum(["arina", "cassandra"]),
  language: z.string().min(2).max(10),
  userName: z.string().optional(),
});

export type PhotoAnalysisJobData = z.infer<typeof PhotoAnalysisJobSchema>;

/**
 * Chat reply job schema
 * Validates job data for chat reply queue
 */
export const ChatReplyJobSchema = z.object({
  telegramUserId: z.number().int().positive(),
  chatId: z.number().int(),
  messageId: z.number().int().positive(),
  text: z.string().min(1).max(10000),
});

export type ChatReplyJobData = z.infer<typeof ChatReplyJobSchema>;

/**
 * Send message job schema
 * Validates job data for send message queue
 */
export const SendMessageJobSchema = z.object({
  telegramUserId: z.number().int().positive(),
  chatId: z.number().int(),
  text: z.string().min(1).max(4096),
  parseMode: z.enum(["HTML", "Markdown"]).optional(),
});

export type SendMessageJobData = z.infer<typeof SendMessageJobSchema>;

/**
 * Engagement job schema
 * Validates job data for engagement/proactive message queue
 */
export const EngagementJobSchema = z.object({
  type: z.enum(["inactive-reminder", "weekly-checkin", "daily-fortune"]),
  scheduledAt: z.string().datetime().optional(),
});

export type EngagementJobData = z.infer<typeof EngagementJobSchema>;
