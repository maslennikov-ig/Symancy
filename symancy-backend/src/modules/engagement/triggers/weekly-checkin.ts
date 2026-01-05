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
 * Criteria:
 * - notifications_enabled = TRUE
 * - onboarding_completed = TRUE
 * - Haven't received weekly-checkin today (checked via engagement_log)
 *
 * @returns Array of users for weekly check-in
 */
export async function findWeeklyCheckInUsers(): Promise<WeeklyCheckInUser[]> {
  const supabase = getSupabase();

  logger.debug("Finding users for weekly check-in");

  // Find all users with notifications enabled
  const { data: users, error } = await supabase
    .from("profiles")
    .select("telegram_user_id, name")
    .eq("notifications_enabled", true)
    .eq("onboarding_completed", true);

  if (error) {
    logger.error({ error }, "Failed to find weekly check-in users");
    throw new Error(`Failed to find weekly check-in users: ${error.message}`);
  }

  if (!users || users.length === 0) {
    logger.info("No users for weekly check-in");
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

  const filteredUsers = users
    .filter((user) => !sentTodayUserIds.has(user.telegram_user_id))
    .map((user) => ({
      telegramUserId: user.telegram_user_id,
      chatId: user.telegram_user_id,
      name: user.name,
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
