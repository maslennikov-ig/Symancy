/**
 * Ask Name node - T049
 * Saves user's name and transitions to ask_goals
 */
import type { OnboardingState } from "../state.js";
import { getBotApi } from "../../../core/telegram.js";
import { getSupabase } from "../../../core/database.js";
import { getLogger } from "../../../core/logger.js";

const logger = getLogger().child({ module: "onboarding:ask-name" });

/**
 * Save user's name and send goals selection message
 * @param state - Current state with name from user message
 */
export async function askName(
  state: OnboardingState
): Promise<Partial<OnboardingState>> {
  const { chatId, telegramUserId, name } = state;

  // If no name provided, this is the initial graph run after welcome
  // Just return step without processing - handler will invoke again with name
  if (!name) {
    logger.debug({ telegramUserId }, "askName called without name, waiting for user input");
    return { step: "ask_name" };
  }

  const bot = getBotApi();
  const supabase = getSupabase();

  try {
    // Save name to profiles table
    const { error: dbError } = await supabase
      .from("profiles")
      .update({ name })
      .eq("telegram_user_id", telegramUserId);

    if (dbError) {
      logger.error({ telegramUserId, error: dbError }, "Failed to save name to database");
      throw dbError;
    }

    logger.info({ telegramUserId, name }, "Name saved to profile");

    // Send goals selection message
    const goalsMessage = `Приятно познакомиться, ${name}! 🌟

Теперь расскажите мне, что вас интересует больше всего? Можете выбрать несколько вариантов.

После выбора нажмите кнопку "✅ Готово".`;

    // Keyboard will be added in T053, for now just send text
    const goalsKeyboard = {
      inline_keyboard: [
        [{ text: "🎯 Карьера", callback_data: "goal:career" }],
        [{ text: "❤️ Отношения", callback_data: "goal:relationships" }],
        [{ text: "🏥 Здоровье", callback_data: "goal:health" }],
        [{ text: "💰 Финансы", callback_data: "goal:finances" }],
        [{ text: "🧘 Духовный рост", callback_data: "goal:spiritual" }],
        [{ text: "✅ Готово", callback_data: "goals:confirm" }],
      ],
    };

    await bot.sendMessage(chatId, goalsMessage, {
      parse_mode: "HTML",
      reply_markup: goalsKeyboard,
    });

    logger.info({ telegramUserId, chatId }, "Goals selection message sent");

    return {
      step: "ask_goals",
      name,
    };
  } catch (error) {
    logger.error({ telegramUserId, error }, "Failed in askName node");
    throw error;
  }
}
