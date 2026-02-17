/**
 * Zod schemas for pg-boss job validation
 * Ensures job data is validated before being sent to queues
 */
import { z } from "zod";

/**
 * Reading topics for Basic vs Pro differentiation
 */
export const ReadingTopicEnum = z.enum([
  "love",
  "career",
  "money",
  "health",
  "family",
  "spiritual",
  "all",
]);

export type ReadingTopic = z.infer<typeof ReadingTopicEnum>;

/**
 * Credit type for consumption
 */
export const CreditTypeEnum = z.enum(["basic", "pro"]);

export type CreditType = z.infer<typeof CreditTypeEnum>;

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
  /** Reading topic: single topic for basic, "all" for pro */
  topic: ReadingTopicEnum.default("all"),
  /** Credit type to consume: basic for single topic, pro for "all" */
  creditType: CreditTypeEnum.default("basic"),
});

export type PhotoAnalysisJobData = z.infer<typeof PhotoAnalysisJobSchema>;

/**
 * Retopic job schema
 * Validates job data for retopic queue (re-reading another topic from same cup)
 */
/** Single topic enum (derived from ReadingTopicEnum, excludes "all") */
export const SingleTopicEnum = ReadingTopicEnum.exclude(["all"]);

export type SingleTopic = z.infer<typeof SingleTopicEnum>;

export const RetopicJobSchema = z.object({
  telegramUserId: z.number().int().positive(),
  chatId: z.number().int(),
  messageId: z.number().int().positive(),
  /** ID of the original analysis that has vision_result */
  analysisId: z.string().uuid(),
  persona: z.enum(["arina", "cassandra"]),
  /** Single topic only (no "all" for retopic) */
  topic: SingleTopicEnum,
  language: z.string().min(2).max(10),
  userName: z.string().optional(),
});

export type RetopicJobData = z.infer<typeof RetopicJobSchema>;

/**
 * Chat reply job schema
 * Validates job data for chat reply queue
 */
export const ChatReplyJobSchema = z.object({
  telegramUserId: z.number().int().positive(),
  chatId: z.number().int(),
  messageId: z.number().int().positive(),
  text: z.string().min(1).max(10000),
  // Omnichannel fields
  omnichannelMessageId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
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
