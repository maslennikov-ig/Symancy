/**
 * Database entity types matching the PostgreSQL schema
 * These types represent rows from Supabase tables
 */

/**
 * Profile from profiles table
 * Extended user profile with onboarding and engagement data
 */
export interface Profile {
  telegram_user_id: number;
  name: string | null;
  language_code: string | null;
  is_admin: boolean;
  is_banned: boolean;
  onboarding_completed: boolean;
  notifications_enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Chat message for conversation history
 * Stores all user-bot interactions with role-based structure
 */
export interface ChatMessage {
  id: string;
  telegram_user_id: number;
  role: "user" | "assistant";
  content: string;
  created_at: Date;
}

/**
 * User state for onboarding and context
 * Tracks current user position in conversational flows
 */
export interface UserState {
  telegram_user_id: number;
  onboarding_step: string | null;
  onboarding_data: { goals?: string[] } | Record<string, unknown>;
  last_analysis_id: string | null;
  daily_messages_count: number;
  last_message_date: string | null;
  /** Daily invalid image counter (for troll protection) */
  daily_invalid_count: number;
  /** Reset timestamp for daily invalid counter */
  daily_invalid_reset_at: string | null;
  updated_at: Date;
}

/**
 * Scheduled message for proactive engagement
 * Queue for time-based bot-initiated messages
 */
export interface ScheduledMessage {
  id: string;
  telegram_user_id: number;
  message_type: string;
  content: string;
  scheduled_at: Date;
  sent_at: Date | null;
  status: "pending" | "sent" | "failed" | "cancelled";
  created_at: Date;
}

/**
 * System configuration entry
 * Dynamic configuration stored in database for runtime updates
 */
export interface SystemConfig {
  key: string;
  value: unknown;
  description: string | null;
  updated_at: Date;
}

/**
 * Analysis history entry (existing table)
 * Historical record of photo analysis requests and results
 */
export interface AnalysisHistory {
  id: string;
  telegram_user_id: number;
  photo_url: string | null;
  vision_result: string | null;
  interpretation: string | null;
  persona: string;
  credits_used: number;
  created_at: Date;
}
