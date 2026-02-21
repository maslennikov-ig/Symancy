/**
 * Inactive Reminder Trigger
 * Find users who haven't interacted in 7+ days
 */
import { getSupabase } from "../../../core/database.js";
import { getLogger } from "../../../core/logger.js";
import { createModel } from "../../../core/langchain/models.js";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";

const logger = getLogger().child({ module: "engagement-inactive" });

export interface InactiveUser {
  telegramUserId: number;
  chatId: number;
  name: string | null;
}

/**
 * Find users who are inactive for 7+ days
 *
 * Criteria (using unified_users table):
 * - last_seen_at < NOW() - INTERVAL '7 days'
 * - is_telegram_linked = TRUE (must have Telegram to receive reminders)
 * - is_banned = FALSE
 * - notification_settings->>'reminders_enabled' != 'false' (null = enabled by default)
 * - Haven't received inactive-reminder today (checked via engagement_log)
 *
 * @returns Array of inactive users
 */
export async function findInactiveUsers(): Promise<InactiveUser[]> {
  const supabase = getSupabase();

  logger.debug("Finding inactive users (7+ days)");

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Find users inactive for 7+ days from unified_users
  // Note: We filter reminders_enabled in JS since Supabase doesn't support JSONB null-coalesce in filters
  const { data: users, error } = await supabase
    .from("unified_users")
    .select("telegram_id, display_name, notification_settings")
    .eq("is_telegram_linked", true)
    .eq("is_banned", false)
    .not("telegram_id", "is", null)
    .lt("last_seen_at", sevenDaysAgo);

  if (error) {
    logger.error({ error }, "Failed to find inactive users");
    throw new Error(`Failed to find inactive users: ${error.message}`);
  }

  if (!users || users.length === 0) {
    logger.info("No inactive users found");
    return [];
  }

  // Filter users with reminders_enabled (null = true by default)
  const usersWithRemindersEnabled = users.filter((user) => {
    const settings = user.notification_settings as { reminders_enabled?: boolean } | null;
    return settings?.reminders_enabled !== false;
  });

  if (usersWithRemindersEnabled.length === 0) {
    logger.info("No inactive users with reminders enabled");
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

  const filteredUsers = usersWithRemindersEnabled
    .filter((user) => user.telegram_id && !sentTodayUserIds.has(user.telegram_id))
    .map((user) => ({
      telegramUserId: user.telegram_id!,
      chatId: user.telegram_id!, // For direct messages, chatId = userId
      name: user.display_name,
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
export async function createInactiveReminderMessage(userName: string | null): Promise<string> {
  const name = userName || "друг";
  const defaultMessage = `☕️ Привет, ${name}!\n\nМы скучаем по вам! Не хотите заглянуть в будущее?\n\nОтправьте фото кофейной гущи, и я раскрою её тайны ✨`;

  try {
    const model = createModel("openai/gpt-oss-120b", { temperature: 0.9, maxTokens: 150 });
    const response = await model.invoke([
      new SystemMessage(
        "Ты — дружелюбная и слегка загадочная гадалка на кофейной гуще. Твоя задача — написать короткое, " +
        "уникальное и привлекательное напоминание для пользователя, который давно не заходил. " +
        "Обязательно упомяни его по имени (если оно есть), скажи, что скучаешь, и предложи прислать фото кофейной гущи " +
        "для предсказания будущего. Сообщение должно быть коротким (до 3-4 предложений), теплым и использовать эмодзи."
      ),
      new HumanMessage(`Напиши напоминание для пользователя с именем: ${name}`),
    ]);
    
    return (response.content as string).trim();
  } catch (error) {
    logger.error({ error }, "Failed to generate AI inactive reminder, using default");
    return defaultMessage;
  }
}

