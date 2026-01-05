/**
 * Daily Fortune Trigger
 * For users who opted into daily fortunes (spiritual goal)
 */
import { getSupabase } from "../../../core/database.js";
import { getLogger } from "../../../core/logger.js";

const logger = getLogger().child({ module: "engagement-daily" });

export interface DailyFortuneUser {
  telegramUserId: number;
  chatId: number;
  name: string | null;
}

/**
 * Find users for daily fortune
 *
 * Criteria:
 * - notifications_enabled = TRUE
 * - onboarding_completed = TRUE
 * - 'spiritual' in goals array
 * - Haven't received daily-fortune today (checked via engagement_log)
 *
 * @returns Array of users for daily fortune
 */
export async function findDailyFortuneUsers(): Promise<DailyFortuneUser[]> {
  const supabase = getSupabase();

  logger.debug("Finding users for daily fortune");

  // Find users with spiritual goal
  const { data: users, error } = await supabase
    .from("profiles")
    .select("telegram_user_id, name, goals")
    .eq("notifications_enabled", true)
    .eq("onboarding_completed", true)
    .contains("goals", ["spiritual"]);

  if (error) {
    logger.error({ error }, "Failed to find daily fortune users");
    throw new Error(`Failed to find daily fortune users: ${error.message}`);
  }

  if (!users || users.length === 0) {
    logger.info("No users for daily fortune");
    return [];
  }

  // Filter out users who already received fortune today
  const today = new Date().toISOString().split("T")[0];

  const { data: sentToday, error: logError } = await supabase
    .from("engagement_log")
    .select("telegram_id")
    .eq("message_type", "daily-fortune")
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

  logger.info({ count: filteredUsers.length }, "Found users for daily fortune");

  return filteredUsers;
}

/**
 * Create daily fortune message
 * Varies with different inspirational messages
 *
 * @returns Formatted message in Russian
 */
export function createDailyFortuneMessage(): string {
  // Array of daily fortune variations
  const fortunes = [
    "Сегодня звёзды благоволят к решительным действиям.\nНе бойтесь делать первый шаг — удача на вашей стороне.",
    "День наполнен возможностями для новых начинаний.\nДоверьтесь своей интуиции.",
    "Сегодня особенно важно прислушаться к своему сердцу.\nОно подскажет верный путь.",
    "Энергия этого дня способствует творчеству и самовыражению.\nПокажите миру свой талант.",
    "Сегодня благоприятный день для общения и новых знакомств.\nБудьте открыты.",
    "День приносит гармонию и равновесие.\nНаслаждайтесь моментом.",
    "Сегодня ваша сила в терпении и настойчивости.\nПродолжайте двигаться к цели.",
  ];

  // Select fortune based on day of year (consistent for same day)
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) /
      (1000 * 60 * 60 * 24)
  );
  const selectedFortune = fortunes[dayOfYear % fortunes.length];

  return `✨ Совет дня\n\n${selectedFortune}\n\n🌙 Хорошего дня!`;
}
