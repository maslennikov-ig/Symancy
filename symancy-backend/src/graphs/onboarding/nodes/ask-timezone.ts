/**
 * Ask Timezone node - T051a
 * Saves user's timezone (for meditation reminders) and transitions to complete
 */
import type { OnboardingState } from "../state.js";
import { getBotApi } from "../../../core/telegram.js";
import { getSupabase } from "../../../core/database.js";
import { getLogger } from "../../../core/logger.js";

const logger = getLogger().child({ module: "onboarding:ask-timezone" });

/**
 * Save user's timezone preference
 * If skipped, defaults to Europe/Moscow
 */
export async function askTimezone(
  state: OnboardingState
): Promise<Partial<OnboardingState>> {
  const { chatId, telegramUserId, timezone, goals } = state;

  // Guard: Don't process if this is premature call during graph traversal
  // Timezone is only asked if goals include "spiritual"
  if (!goals || goals.length === 0) {
    logger.debug({ telegramUserId }, "askTimezone called prematurely, skipping");
    return { step: "ask_timezone" };
  }

  const bot = getBotApi();
  const supabase = getSupabase();

  // Use provided timezone or default to Europe/Moscow
  const finalTimezone = timezone || "Europe/Moscow";

  try {
    // Save timezone to profiles table
    const { error: dbError } = await supabase
      .from("profiles")
      .update({ timezone: finalTimezone })
      .eq("telegram_user_id", telegramUserId);

    if (dbError) {
      logger.error(
        { telegramUserId, error: dbError },
        "Failed to save timezone to database"
      );
      throw dbError;
    }

    logger.info({ telegramUserId, timezone: finalTimezone }, "Timezone saved to profile");

    // Send confirmation message
    const confirmMessage = `🌍 Часовой пояс установлен: ${finalTimezone}

Теперь я смогу отправлять вам напоминания о медитации в удобное время.`;

    await bot.sendMessage(chatId, confirmMessage, {
      parse_mode: "HTML",
    });

    logger.info({ telegramUserId, chatId }, "Timezone confirmation sent");

    return {
      step: "complete",
      timezone: finalTimezone,
    };
  } catch (error) {
    logger.error({ telegramUserId, error }, "Failed in askTimezone node");
    throw error;
  }
}
