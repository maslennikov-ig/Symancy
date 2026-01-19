/**
 * Weekly Check-in Trigger
 * Monday 10:00 MSK check-in for engaged users
 */
import { getSupabase } from "../../../core/database.js";
import { getLogger } from "../../../core/logger.js";

const logger = getLogger().child({ module: "engagement-weekly" });

export interface WeeklyCheckInUser {
  telegramUserId: number;
  chatId: number;
  name: string | null;
}

/**
 * Find users for weekly check-in
 *
 * Criteria (using unified_users table):
 * - is_telegram_linked = TRUE (must have Telegram to receive reminders)
 * - is_banned = FALSE
 * - notification_settings->>'reminders_enabled' != 'false' (null = enabled by default)
 * - Haven't received weekly-checkin today (checked via engagement_log)
 *
 * @returns Array of users for weekly check-in
 */
export async function findWeeklyCheckInUsers(): Promise<WeeklyCheckInUser[]> {
  const supabase = getSupabase();

  logger.debug("Finding users for weekly check-in");

  // Find all users with Telegram linked from unified_users
  // Note: We filter reminders_enabled in JS since Supabase doesn't support JSONB null-coalesce in filters
  const { data: users, error } = await supabase
    .from("unified_users")
    .select("telegram_id, display_name, notification_settings")
    .eq("is_telegram_linked", true)
    .eq("is_banned", false)
    .not("telegram_id", "is", null);

  if (error) {
    logger.error({ error }, "Failed to find weekly check-in users");
    throw new Error(`Failed to find weekly check-in users: ${error.message}`);
  }

  if (!users || users.length === 0) {
    logger.info("No users for weekly check-in");
    return [];
  }

  // Filter users with reminders_enabled (null = true by default)
  const usersWithRemindersEnabled = users.filter((user) => {
    const settings = user.notification_settings as { reminders_enabled?: boolean } | null;
    return settings?.reminders_enabled !== false;
  });

  if (usersWithRemindersEnabled.length === 0) {
    logger.info("No users with reminders enabled for weekly check-in");
    return [];
  }

  // Filter out users who already received check-in today
  const today = new Date().toISOString().split("T")[0];

  const { data: sentToday, error: logError } = await supabase
    .from("engagement_log")
    .select("telegram_id")
    .eq("message_type", "weekly-checkin")
    .gte("sent_at", `${today}T00:00:00Z`);

  if (logError) {
    logger.warn({ error: logError }, "Failed to check engagement log, continuing");
  }

  const sentTodayUserIds = new Set(
    sentToday?.map((log) => log.telegram_id) || []
  );

  const filteredUsers = usersWithRemindersEnabled
    .filter((user) => user.telegram_id && !sentTodayUserIds.has(user.telegram_id))
    .map((user) => ({
      telegramUserId: user.telegram_id!,
      chatId: user.telegram_id!,
      name: user.display_name,
    }));

  logger.info({ count: filteredUsers.length }, "Found users for weekly check-in");

  return filteredUsers;
}

/**
 * Create weekly check-in message
 *
 * @param userName - User's name (or null)
 * @returns Formatted message in Russian
 */
export function createWeeklyCheckInMessage(userName: string | null): string {
  const name = userName || "друг";

  return (
    `🌟 Доброе утро, ${name}!\n\n` +
    `Новая неделя — новые возможности!\n\n` +
    `Хотите узнать, что принесёт эта неделя? ☕️`
  );
}
