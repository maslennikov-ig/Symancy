/**
 * Inactive Reminder Trigger
 * Find users who haven't interacted in 7+ days
 */
import { getSupabase } from "../../../core/database.js";
import { getLogger } from "../../../core/logger.js";

const logger = getLogger().child({ module: "engagement-inactive" });

export interface InactiveUser {
  telegramUserId: number;
  chatId: number;
  name: string | null;
}

/**
 * Find users who are inactive for 7+ days
 *
 * Criteria:
 * - last_interaction_at < NOW() - INTERVAL '7 days'
 * - notifications_enabled = TRUE
 * - onboarding_completed = TRUE
 * - Haven't received inactive-reminder today (checked via engagement_log)
 *
 * @returns Array of inactive users
 */
export async function findInactiveUsers(): Promise<InactiveUser[]> {
  const supabase = getSupabase();

  logger.debug("Finding inactive users (7+ days)");

  // Find users inactive for 7+ days
  const { data: users, error } = await supabase
    .from("profiles")
    .select("telegram_user_id, name")
    .eq("notifications_enabled", true)
    .eq("onboarding_completed", true)
    .lt("last_interaction_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  if (error) {
    logger.error({ error }, "Failed to find inactive users");
    throw new Error(`Failed to find inactive users: ${error.message}`);
  }

  if (!users || users.length === 0) {
    logger.info("No inactive users found");
    return [];
  }

  // Filter out users who already received reminder today
  const today = new Date().toISOString().split("T")[0];

  const { data: sentToday, error: logError } = await supabase
    .from("engagement_log")
    .select("telegram_id")
    .eq("message_type", "inactive-reminder")
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
      chatId: user.telegram_user_id, // For direct messages, chatId = userId
      name: user.name,
    }));

  logger.info({ count: filteredUsers.length }, "Found inactive users");

  return filteredUsers;
}

/**
 * Create inactive reminder message
 *
 * @param userName - User's name (or null)
 * @returns Formatted message in Russian
 */
export function createInactiveReminderMessage(userName: string | null): string {
  const name = userName || "друг";

  return (
    `☕️ Привет, ${name}!\n\n` +
    `Мы скучаем по вам! Не хотите заглянуть в будущее?\n\n` +
    `Отправьте фото кофейной гущи, и я раскрою её тайны ✨`
  );
}
