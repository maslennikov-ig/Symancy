/**
 * ProactiveMessageService - Handles proactive messaging to users
 *
 * Responsibilities:
 * - Find eligible users for proactive messages (with Telegram linked)
 * - Send engagement messages only to Telegram-linked users
 * - Handle delivery failures and user status updates
 *
 * Per spec (US5): Proactive messages ONLY go to users with messenger channel.
 * Web-only users (is_telegram_linked=false) receive nothing.
 */

import { getSupabase } from "../../core/database.js";
import { getLogger } from "../../core/logger.js";
import { getDeliveryService } from "../delivery/DeliveryService.js";

// =============================================================================
// TYPES
// =============================================================================

/**
 * User eligible for proactive messaging
 * Must have Telegram linked (is_telegram_linked=true)
 */
export interface ProactiveEligibleUser {
  /** Unified user ID */
  id: string;
  /** Telegram user ID (guaranteed non-null for eligible users) */
  telegramId: number;
  /** User display name */
  displayName: string | null;
  /** User language code */
  languageCode: string;
  /** Last active timestamp */
  lastActiveAt: Date;
}

/**
 * Proactive message type enumeration
 */
export type ProactiveMessageType =
  | "inactive-reminder"
  | "weekly-checkin"
  | "daily-fortune";

/**
 * Result of sending proactive message
 */
export interface ProactiveMessageResult {
  success: boolean;
  userId: string;
  telegramId: number;
  messageType: ProactiveMessageType;
  errorMessage?: string;
  /** True if user should be marked as inactive (blocked bot) */
  userBlocked?: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Rate limit delay between sending messages (ms)
 * Telegram limit: ~30 messages/second to different users
 * We use 100ms (10 messages/second) to be safe
 */
const RATE_LIMIT_DELAY_MS = 100;

/**
 * Error patterns that indicate user blocked the bot
 */
const BOT_BLOCKED_PATTERNS = [
  /bot was blocked/i,
  /user is deactivated/i,
  /BLOCKED_BY_USER/i,
  /Forbidden: bot was blocked by the user/i,
  /chat not found/i,
];

// =============================================================================
// SERVICE CLASS
// =============================================================================

/**
 * ProactiveMessageService - Singleton for proactive messaging operations
 */
export class ProactiveMessageService {
  private static instance: ProactiveMessageService | null = null;
  private readonly logger = getLogger().child({ module: "proactive-message" });

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ProactiveMessageService {
    if (!ProactiveMessageService.instance) {
      ProactiveMessageService.instance = new ProactiveMessageService();
    }
    return ProactiveMessageService.instance;
  }

  // ===========================================================================
  // USER QUERIES
  // ===========================================================================

  /**
   * Find users eligible for inactive reminders (7+ days inactive)
   *
   * Criteria:
   * - is_telegram_linked = true (REQUIRED - per spec US5)
   * - last_active_at < NOW() - INTERVAL '7 days'
   * - notification_settings.enabled = true
   * - onboarding_completed = true
   * - Haven't received inactive-reminder today (via engagement_log)
   *
   * @returns Array of eligible users
   */
  public async findInactiveUsers(): Promise<ProactiveEligibleUser[]> {
    this.logger.debug("Finding inactive users (7+ days)");

    const supabase = getSupabase();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Query unified_users for Telegram-linked, inactive users
    const { data: users, error } = await supabase
      .from("unified_users")
      .select("id, telegram_id, display_name, language_code, last_active_at")
      .eq("is_telegram_linked", true)
      .eq("onboarding_completed", true)
      .eq("is_banned", false)
      .lt("last_active_at", sevenDaysAgo)
      .not("telegram_id", "is", null);

    if (error) {
      this.logger.error({ error }, "Failed to find inactive users");
      throw new Error(`Failed to find inactive users: ${error.message}`);
    }

    if (!users || users.length === 0) {
      this.logger.info("No inactive users found");
      return [];
    }

    // Filter out users with disabled notifications
    // notification_settings is JSONB, default is { enabled: true }
    // For now, assume all users have notifications enabled
    const usersWithNotifications = users;

    // Filter out users who already received reminder today
    const filteredUsers = await this.filterAlreadyNotifiedToday(
      usersWithNotifications,
      "inactive-reminder"
    );

    this.logger.info({ count: filteredUsers.length }, "Found inactive users for proactive messaging");

    return filteredUsers.map((user) => ({
      id: user.id,
      telegramId: user.telegram_id as number,
      displayName: user.display_name,
      languageCode: user.language_code,
      lastActiveAt: new Date(user.last_active_at),
    }));
  }

  /**
   * Find users eligible for weekly check-in (all active Telegram users)
   *
   * Criteria:
   * - is_telegram_linked = true (REQUIRED - per spec US5)
   * - notification_settings.enabled = true
   * - onboarding_completed = true
   * - Haven't received weekly-checkin today
   *
   * @returns Array of eligible users
   */
  public async findWeeklyCheckInUsers(): Promise<ProactiveEligibleUser[]> {
    this.logger.debug("Finding users for weekly check-in");

    const supabase = getSupabase();

    const { data: users, error } = await supabase
      .from("unified_users")
      .select("id, telegram_id, display_name, language_code, last_active_at")
      .eq("is_telegram_linked", true)
      .eq("onboarding_completed", true)
      .eq("is_banned", false)
      .not("telegram_id", "is", null);

    if (error) {
      this.logger.error({ error }, "Failed to find weekly check-in users");
      throw new Error(`Failed to find weekly check-in users: ${error.message}`);
    }

    if (!users || users.length === 0) {
      this.logger.info("No users for weekly check-in");
      return [];
    }

    // Filter out users who already received check-in today
    const filteredUsers = await this.filterAlreadyNotifiedToday(users, "weekly-checkin");

    this.logger.info({ count: filteredUsers.length }, "Found users for weekly check-in");

    return filteredUsers.map((user) => ({
      id: user.id,
      telegramId: user.telegram_id as number,
      displayName: user.display_name,
      languageCode: user.language_code,
      lastActiveAt: new Date(user.last_active_at),
    }));
  }

  /**
   * Find users eligible for daily fortune
   *
   * Criteria:
   * - is_telegram_linked = true (REQUIRED - per spec US5)
   * - notification_settings.enabled = true
   * - onboarding_completed = true
   * - Haven't received daily-fortune today
   *
   * @returns Array of eligible users
   */
  public async findDailyFortuneUsers(): Promise<ProactiveEligibleUser[]> {
    this.logger.debug("Finding users for daily fortune");

    const supabase = getSupabase();

    const { data: users, error } = await supabase
      .from("unified_users")
      .select("id, telegram_id, display_name, language_code, last_active_at")
      .eq("is_telegram_linked", true)
      .eq("onboarding_completed", true)
      .eq("is_banned", false)
      .not("telegram_id", "is", null);

    if (error) {
      this.logger.error({ error }, "Failed to find daily fortune users");
      throw new Error(`Failed to find daily fortune users: ${error.message}`);
    }

    if (!users || users.length === 0) {
      this.logger.info("No users for daily fortune");
      return [];
    }

    // Filter out users who already received fortune today
    const filteredUsers = await this.filterAlreadyNotifiedToday(users, "daily-fortune");

    this.logger.info({ count: filteredUsers.length }, "Found users for daily fortune");

    return filteredUsers.map((user) => ({
      id: user.id,
      telegramId: user.telegram_id as number,
      displayName: user.display_name,
      languageCode: user.language_code,
      lastActiveAt: new Date(user.last_active_at),
    }));
  }

  // ===========================================================================
  // MESSAGE SENDING
  // ===========================================================================

  /**
   * Send engagement message to a user
   *
   * Per spec (US5): Only sends to users with is_telegram_linked=true.
   * Handles bot blocked errors and marks user as inactive.
   *
   * @param user - User to send message to
   * @param messageType - Type of proactive message
   * @param content - Message content (HTML formatted)
   * @returns ProactiveMessageResult
   */
  public async sendEngagementMessage(
    user: ProactiveEligibleUser,
    messageType: ProactiveMessageType,
    content: string
  ): Promise<ProactiveMessageResult> {
    const logger = this.logger.child({
      method: "sendEngagementMessage",
      userId: user.id,
      telegramId: user.telegramId,
      messageType,
    });

    logger.debug({ contentLength: content.length }, "Sending engagement message");

    // Double-check: user must have Telegram linked
    if (!user.telegramId) {
      logger.warn("Attempted to send proactive message to user without Telegram");
      return {
        success: false,
        userId: user.id,
        telegramId: 0,
        messageType,
        errorMessage: "User does not have Telegram linked",
      };
    }

    try {
      // Send via DeliveryService
      const deliveryService = getDeliveryService();
      const result = await deliveryService.deliverToTelegram(
        user.telegramId,
        content,
        { parse_mode: "HTML" }
      );

      if (result.success) {
        // Log successful send to engagement_log
        await this.logSentMessage(user.telegramId, messageType);

        logger.info(
          { externalMessageId: result.externalMessageId },
          "Engagement message sent successfully"
        );

        return {
          success: true,
          userId: user.id,
          telegramId: user.telegramId,
          messageType,
        };
      } else {
        // Check if user blocked the bot
        const userBlocked = this.isUserBlockedError(result.errorMessage);

        if (userBlocked) {
          // Mark user as inactive (T053 requirement)
          await this.markUserInactive(user.id, user.telegramId);
          logger.warn("User blocked bot, marked as inactive");
        }

        return {
          success: false,
          userId: user.id,
          telegramId: user.telegramId,
          messageType,
          errorMessage: result.errorMessage,
          userBlocked,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const userBlocked = this.isUserBlockedError(errorMessage);

      if (userBlocked) {
        await this.markUserInactive(user.id, user.telegramId);
      }

      logger.error({ error, userBlocked }, "Failed to send engagement message");

      return {
        success: false,
        userId: user.id,
        telegramId: user.telegramId,
        messageType,
        errorMessage,
        userBlocked,
      };
    }
  }

  /**
   * Send batch of engagement messages with rate limiting
   *
   * @param users - Users to send to
   * @param messageType - Type of proactive message
   * @param contentGenerator - Function to generate message content per user
   * @returns Summary of results
   */
  public async sendBatchEngagementMessages(
    users: ProactiveEligibleUser[],
    messageType: ProactiveMessageType,
    contentGenerator: (user: ProactiveEligibleUser) => string
  ): Promise<{
    total: number;
    success: number;
    failed: number;
    blocked: number;
  }> {
    const logger = this.logger.child({ method: "sendBatchEngagementMessages", messageType });

    logger.info({ count: users.length }, "Sending batch engagement messages");

    let successCount = 0;
    let failedCount = 0;
    let blockedCount = 0;

    for (const user of users) {
      const content = contentGenerator(user);
      const result = await this.sendEngagementMessage(user, messageType, content);

      if (result.success) {
        successCount++;
      } else {
        failedCount++;
        if (result.userBlocked) {
          blockedCount++;
        }
      }

      // Rate limiting
      await this.sleep(RATE_LIMIT_DELAY_MS);
    }

    logger.info(
      { total: users.length, success: successCount, failed: failedCount, blocked: blockedCount },
      "Batch engagement messages completed"
    );

    return {
      total: users.length,
      success: successCount,
      failed: failedCount,
      blocked: blockedCount,
    };
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  /**
   * Check if error indicates user blocked the bot
   */
  private isUserBlockedError(errorMessage?: string): boolean {
    if (!errorMessage) return false;
    return BOT_BLOCKED_PATTERNS.some((pattern) => pattern.test(errorMessage));
  }

  /**
   * Mark user as inactive after bot block
   * Updates unified_users to indicate user blocked bot
   */
  private async markUserInactive(userId: string, telegramId: number): Promise<void> {
    const supabase = getSupabase();

    this.logger.info({ userId, telegramId }, "Marking user as inactive (bot blocked)");

    // Update notification_settings to disable notifications
    const { error } = await supabase
      .from("unified_users")
      .update({
        notification_settings: { enabled: false, blocked_at: new Date().toISOString() },
      })
      .eq("id", userId);

    if (error) {
      this.logger.error({ error, userId }, "Failed to mark user as inactive");
      // Don't throw - continue processing other users
    }
  }

  /**
   * Log sent message to engagement_log table
   */
  private async logSentMessage(
    telegramId: number,
    messageType: ProactiveMessageType
  ): Promise<void> {
    const supabase = getSupabase();

    const { error } = await supabase.from("engagement_log").insert({
      telegram_user_id: telegramId,
      message_type: messageType,
    });

    if (error) {
      this.logger.warn(
        { error, telegramId, messageType },
        "Failed to log sent message"
      );
      // Don't throw - logging failure is not critical
    }
  }

  /**
   * Filter out users who already received notification today
   */
  private async filterAlreadyNotifiedToday<T extends { telegram_id: number | null }>(
    users: T[],
    messageType: ProactiveMessageType
  ): Promise<T[]> {
    const supabase = getSupabase();
    const today = new Date().toISOString().split("T")[0];

    const { data: sentToday, error } = await supabase
      .from("engagement_log")
      .select("telegram_user_id")
      .eq("message_type", messageType)
      .gte("sent_at", `${today}T00:00:00Z`);

    if (error) {
      this.logger.warn({ error }, "Failed to check engagement log, continuing");
      return users;
    }

    const sentTodayUserIds = new Set(
      sentToday?.map((log) => log.telegram_user_id) || []
    );

    return users.filter((user) => !sentTodayUserIds.has(user.telegram_id));
  }

  /**
   * Sleep helper for rate limiting
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

/**
 * Get singleton ProactiveMessageService instance
 */
export function getProactiveMessageService(): ProactiveMessageService {
  return ProactiveMessageService.getInstance();
}
