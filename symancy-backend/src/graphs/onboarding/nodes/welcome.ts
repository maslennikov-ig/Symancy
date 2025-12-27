/**
 * Welcome node - T048
 * Sends welcome message and waits for user to provide their name
 */
import type { OnboardingState } from "../state.js";
import { getBotApi } from "../../../core/telegram.js";
import { getLogger } from "../../../core/logger.js";

const logger = getLogger().child({ module: "onboarding:welcome" });

/**
 * Send welcome message to user
 * After this, graph stops and waits for user input (name)
 * Handler will save step="ask_name" to DB and re-invoke when user responds
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

    // Return step="ask_name" - this tells handler what step user is on
    // Graph will stop here (routeAfterWelcome returns END when no name)
    return {
      step: "ask_name",
    };
  } catch (error) {
    logger.error({ telegramUserId, chatId, error }, "Failed to send welcome message");
    throw error;
  }
}
