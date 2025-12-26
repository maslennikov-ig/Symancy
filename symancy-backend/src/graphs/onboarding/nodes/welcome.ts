/**
 * Welcome node - T048
 * Sends welcome message and transitions to ask_name step
 */
import type { OnboardingState } from "../state.js";
import { getBotApi } from "../../../core/telegram.js";
import { getLogger } from "../../../core/logger.js";

const logger = getLogger().child({ module: "onboarding:welcome" });

/**
 * Send welcome message to user
 * Explains what the bot does (coffee fortune telling)
 */
export async function welcome(
  state: OnboardingState
): Promise<Partial<OnboardingState>> {
  const { chatId, telegramUserId } = state;
  const bot = getBotApi();

  const welcomeMessage = `☕️ Добро пожаловать в Симанси!

Я помогу вам заглянуть в будущее через кофейную гущу.

Давайте познакомимся! Как мне к вам обращаться?

<i>Просто напишите ваше имя или как бы вы хотели, чтобы я вас называла.</i>`;

  try {
    await bot.sendMessage(chatId, welcomeMessage, {
      parse_mode: "HTML",
    });

    logger.info({ telegramUserId, chatId }, "Welcome message sent");

    return {
      step: "ask_name",
    };
  } catch (error) {
    logger.error({ telegramUserId, chatId, error }, "Failed to send welcome message");
    throw error;
  }
}
