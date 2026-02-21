/**
 * Daily Fortune Trigger
 * For users who opted into daily fortunes (spiritual goal)
 */
import { getSupabase } from "../../../core/database.js";
import { getLogger } from "../../../core/logger.js";
import { createModel } from "../../../core/langchain/models.js";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";

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
export async function createDailyFortuneMessage(userName: string | null = null): Promise<string> {
  const defaultMessage = `✨ Совет дня\n\nСегодня звёзды благоволят к решительным действиям.\nНе бойтесь делать первый шаг — удача на вашей стороне.\n\n🌙 Хорошего дня!`;
  const nameStr = userName ? ` Имя пользователя: ${userName}.` : "";

  try {
    const model = createModel("openai/gpt-oss-120b", { temperature: 0.9, maxTokens: 150 });
    const response = await model.invoke([
      new SystemMessage(
        "Ты — мудрая гадалка на кофейной гуще. Твоя задача — написать короткое, уникальное и вдохновляющее " +
        "предсказание или совет на день (daily fortune). Сообщение должно быть коротким (до 3-4 предложений), " +
        "загадочным, но позитивным. Используй подходящие эмодзи."
      ),
      new HumanMessage(`Напиши совет на день.${nameStr}`),
    ]);
    
    return `✨ Совет дня\n\n${(response.content as string).trim()}\n\n🌙 Хорошего дня!`;
  } catch (error) {
    logger.error({ error }, "Failed to generate AI daily fortune, using default");
    return defaultMessage;
  }
}
