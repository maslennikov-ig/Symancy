/**
 * Ask Name node - T049
 * Saves user's name and transitions to ask_goals
 *
 * Smart name handling:
 * - If user confirms with "да", "ок", etc. -> use suggested name from Telegram
 * - Otherwise use whatever they typed
 */
import type { OnboardingState } from "../state.js";
import { getBotApi } from "../../../core/telegram.js";
import { getSupabase } from "../../../core/database.js";
import { getLogger } from "../../../core/logger.js";

const logger = getLogger().child({ module: "onboarding:ask-name" });

/**
 * Common confirmation phrases that mean "yes, use the suggested name"
 */
const CONFIRMATION_PHRASES = [
  'да', 'да!', 'да.', 'ага', 'угу', 'ок', 'ok', 'окей', 'oкей',
  'хорошо', 'ладно', 'отлично', 'супер', 'класс', 'можно', 'конечно',
  'да, так', 'так', 'так хорошо', 'норм', 'нормально', 'пойдёт', 'пойдет',
  'yes', 'yep', 'yeah', 'sure', 'fine', 'good', 'great',
  '+', '👍', '👌', '✅', '😊', '🙂',
];

/**
 * Check if user's response is a confirmation of the suggested name
 */
function isConfirmation(text: string): boolean {
  const normalized = text.toLowerCase().trim();
  return CONFIRMATION_PHRASES.includes(normalized);
}

/**
 * Latin-to-Cyrillic name mapping (same as in welcome.ts)
 * TODO: Extract to shared utility
 */
const LATIN_TO_CYRILLIC: Record<string, string> = {
  'igor': 'Игорь', 'ivan': 'Иван', 'sergey': 'Сергей', 'sergei': 'Сергей',
  'alexander': 'Александр', 'alex': 'Алекс', 'andrey': 'Андрей', 'andrei': 'Андрей',
  'dmitry': 'Дмитрий', 'dmitri': 'Дмитрий', 'maxim': 'Максим', 'max': 'Макс',
  'mikhail': 'Михаил', 'michael': 'Михаил', 'nikolay': 'Николай', 'nikolai': 'Николай',
  'pavel': 'Павел', 'paul': 'Павел', 'vladimir': 'Владимир', 'vlad': 'Влад',
  'viktor': 'Виктор', 'victor': 'Виктор', 'oleg': 'Олег', 'roman': 'Роман',
  'denis': 'Денис', 'artem': 'Артём', 'kirill': 'Кирилл', 'yuri': 'Юрий',
  'evgeny': 'Евгений', 'eugene': 'Евгений', 'konstantin': 'Константин',
  'boris': 'Борис', 'nikita': 'Никита', 'ilya': 'Илья', 'egor': 'Егор',
  'alexei': 'Алексей', 'alexey': 'Алексей',
  'anna': 'Анна', 'maria': 'Мария', 'mary': 'Мария', 'elena': 'Елена',
  'helen': 'Елена', 'olga': 'Ольга', 'irina': 'Ирина', 'natalia': 'Наталья',
  'tatiana': 'Татьяна', 'ekaterina': 'Екатерина', 'katerina': 'Екатерина',
  'kate': 'Катя', 'svetlana': 'Светлана', 'marina': 'Марина', 'julia': 'Юлия',
  'yulia': 'Юлия', 'anastasia': 'Анастасия', 'victoria': 'Виктория',
  'oksana': 'Оксана', 'alina': 'Алина', 'daria': 'Дарья', 'polina': 'Полина',
  'ksenia': 'Ксения', 'xenia': 'Ксения', 'valentina': 'Валентина',
  'vera': 'Вера', 'alexandra': 'Александра', 'kristina': 'Кристина',
  'diana': 'Диана', 'kira': 'Кира', 'veronika': 'Вероника', 'valeria': 'Валерия',
  'elizaveta': 'Елизавета', 'elizabeth': 'Елизавета', 'sofya': 'Софья',
  'sofia': 'София', 'sophia': 'София', 'alisa': 'Алиса', 'alice': 'Алиса',
  'arina': 'Арина', 'eva': 'Ева',
};

/**
 * Save user's name and send goals selection message
 * @param state - Current state with name from user message
 */
export async function askName(
  state: OnboardingState
): Promise<Partial<OnboardingState>> {
  const { chatId, telegramUserId, name } = state;

  // If no name provided, return current step (graph will stop via routeAfterAskName)
  if (!name) {
    logger.debug({ telegramUserId }, "askName: waiting for user to provide name");
    return { step: "ask_name" };
  }

  const bot = getBotApi();
  const supabase = getSupabase();

  // Determine the actual name to save
  let nameToSave = name.trim();

  // Check if user is confirming the suggested name
  if (isConfirmation(name)) {
    // Get the Telegram first_name and use it (or Cyrillic version)
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name")
      .eq("telegram_user_id", telegramUserId)
      .single();

    const telegramFirstName = profile?.first_name;

    if (telegramFirstName) {
      // Try to use Cyrillic version if available
      const cyrillicName = LATIN_TO_CYRILLIC[telegramFirstName.toLowerCase()];
      nameToSave = cyrillicName || telegramFirstName;

      logger.info(
        { telegramUserId, originalInput: name, telegramFirstName, nameToSave },
        "User confirmed suggested name"
      );
    }
  }

  try {
    // Save name to profiles table
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ name: nameToSave })
      .eq("telegram_user_id", telegramUserId);

    if (profileError) {
      logger.error({ telegramUserId, error: profileError }, "Failed to save name to profiles");
      throw profileError;
    }

    // Sync with unified_users.display_name for consistency
    const { error: unifiedError } = await supabase
      .from("unified_users")
      .update({ display_name: nameToSave })
      .eq("telegram_id", telegramUserId);

    if (unifiedError) {
      // Log warning but don't fail - profiles is the source of truth
      logger.warn({ telegramUserId, error: unifiedError }, "Failed to sync name to unified_users");
    } else {
      logger.debug({ telegramUserId }, "Name synced to unified_users.display_name");
    }

    logger.info({ telegramUserId, name: nameToSave, originalInput: name }, "Name saved to profile");

    // Send goals selection message - use informal "ты" style
    const goalsMessage = `Приятно познакомиться, ${nameToSave}! 🌟

Расскажи, что тебя интересует больше всего? Можешь выбрать несколько вариантов.

Когда закончишь — нажми "✅ Готово".`;

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
      name: nameToSave,
    };
  } catch (error) {
    logger.error({ telegramUserId, error }, "Failed in askName node");
    throw error;
  }
}
