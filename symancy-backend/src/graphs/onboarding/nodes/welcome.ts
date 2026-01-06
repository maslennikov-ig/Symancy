/**
 * Welcome node - T048
 * Sends welcome message and waits for user to provide their name
 *
 * Smart name handling:
 * - If Telegram first_name looks like a real name (Cyrillic/Latin letters) -> suggest it
 * - If it's a nickname or weird -> just ask for name warmly
 */
import type { OnboardingState } from "../state.js";
import { getBotApi } from "../../../core/telegram.js";
import { getSupabase } from "../../../core/database.js";
import { getLogger } from "../../../core/logger.js";

const logger = getLogger().child({ module: "onboarding:welcome" });

/**
 * Check if a name looks like a real human name (not a nickname)
 * Real names: Igor, Анна, Jean, María, 张伟
 * Nicknames: xXx_Player, cool_guy_228, 🔥KING🔥
 */
function looksLikeRealName(name: string | null): boolean {
  if (!name || name.length < 2 || name.length > 30) return false;

  // Check for suspicious patterns that indicate nicknames
  const nicknamePatterns = [
    /[_\d]{2,}/, // Multiple underscores or digits together
    /^[a-z]{2,3}[A-Z]/, // camelCase start like "xXx"
    /^\d/, // Starts with number
    /\d{3,}/, // Three or more digits
    /[^\p{L}\s\-']/u, // Contains non-letter characters (except space, hyphen, apostrophe)
    /(.)\1{2,}/, // Same character repeated 3+ times
  ];

  for (const pattern of nicknamePatterns) {
    if (pattern.test(name)) return false;
  }

  // Check that it's mostly letters (Cyrillic, Latin, Chinese, etc.)
  const letterCount = (name.match(/\p{L}/gu) || []).length;
  return letterCount >= name.length * 0.7;
}

/**
 * Suggest Cyrillic version for common Latin names (for Russian users)
 * Igor -> Игорь, Anna -> Анна, etc.
 */
function suggestCyrillicName(latinName: string): string | null {
  const commonTransliterations: Record<string, string> = {
    // Male names
    'igor': 'Игорь',
    'ivan': 'Иван',
    'sergey': 'Сергей',
    'sergei': 'Сергей',
    'alexander': 'Александр',
    'alex': 'Алекс',
    'andrey': 'Андрей',
    'andrei': 'Андрей',
    'dmitry': 'Дмитрий',
    'dmitri': 'Дмитрий',
    'maxim': 'Максим',
    'max': 'Макс',
    'mikhail': 'Михаил',
    'michael': 'Михаил',
    'nikolay': 'Николай',
    'nikolai': 'Николай',
    'pavel': 'Павел',
    'paul': 'Павел',
    'vladimir': 'Владимир',
    'vlad': 'Влад',
    'viktor': 'Виктор',
    'victor': 'Виктор',
    'oleg': 'Олег',
    'roman': 'Роман',
    'denis': 'Денис',
    'artem': 'Артём',
    'kirill': 'Кирилл',
    'yuri': 'Юрий',
    'yury': 'Юрий',
    'evgeny': 'Евгений',
    'eugene': 'Евгений',
    'konstantin': 'Константин',
    'stanislav': 'Станислав',
    'boris': 'Борис',
    'leonid': 'Леонид',
    'grigory': 'Григорий',
    'anatoly': 'Анатолий',
    'valery': 'Валерий',
    'vasily': 'Василий',
    'timur': 'Тимур',
    'ruslan': 'Руслан',
    'artur': 'Артур',
    'arthur': 'Артур',
    'danila': 'Данила',
    'daniel': 'Даниил',
    'nikita': 'Никита',
    'ilya': 'Илья',
    'egor': 'Егор',
    'yaroslav': 'Ярослав',
    'gleb': 'Глеб',
    'matvey': 'Матвей',
    'fedor': 'Фёдор',
    'fyodor': 'Фёдор',
    'stepan': 'Степан',
    'semyon': 'Семён',
    'lev': 'Лев',
    'mark': 'Марк',
    'timofey': 'Тимофей',
    'alexei': 'Алексей',
    'alexey': 'Алексей',
    // Female names
    'anna': 'Анна',
    'maria': 'Мария',
    'mary': 'Мария',
    'elena': 'Елена',
    'helen': 'Елена',
    'olga': 'Ольга',
    'irina': 'Ирина',
    'natalia': 'Наталья',
    'natalya': 'Наталья',
    'tatiana': 'Татьяна',
    'tatyana': 'Татьяна',
    'ekaterina': 'Екатерина',
    'katerina': 'Екатерина',
    'kate': 'Катя',
    'svetlana': 'Светлана',
    'marina': 'Марина',
    'julia': 'Юлия',
    'yulia': 'Юлия',
    'anastasia': 'Анастасия',
    'victoria': 'Виктория',
    'oksana': 'Оксана',
    'alina': 'Алина',
    'daria': 'Дарья',
    'darya': 'Дарья',
    'polina': 'Полина',
    'ksenia': 'Ксения',
    'xenia': 'Ксения',
    'valentina': 'Валентина',
    'galina': 'Галина',
    'ludmila': 'Людмила',
    'lyudmila': 'Людмила',
    'larisa': 'Лариса',
    'vera': 'Вера',
    'nadezhda': 'Надежда',
    'lyubov': 'Любовь',
    'alexandra': 'Александра',
    'evgenia': 'Евгения',
    'kristina': 'Кристина',
    'christina': 'Кристина',
    'diana': 'Диана',
    'kira': 'Кира',
    'veronika': 'Вероника',
    'veronica': 'Вероника',
    'valeria': 'Валерия',
    'elizaveta': 'Елизавета',
    'elizabeth': 'Елизавета',
    'sofya': 'Софья',
    'sofia': 'София',
    'sophia': 'София',
    'milana': 'Милана',
    'alisa': 'Алиса',
    'alice': 'Алиса',
    'arina': 'Арина',
    'eva': 'Ева',
    'zlata': 'Злата',
  };

  const normalized = latinName.toLowerCase().trim();
  return commonTransliterations[normalized] || null;
}

/**
 * Check if name is already in Cyrillic
 */
function isCyrillic(name: string): boolean {
  return /^[\p{Script=Cyrillic}\s\-']+$/u.test(name);
}

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
  const supabase = getSupabase();

  // Get Telegram first_name from profile (saved during profile creation)
  let telegramFirstName: string | null = null;
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name")
      .eq("telegram_user_id", telegramUserId)
      .single();

    telegramFirstName = profile?.first_name || null;
  } catch {
    // Ignore errors - just proceed without the name
  }

  let welcomeMessage: string;

  if (telegramFirstName && looksLikeRealName(telegramFirstName)) {
    // Good name from Telegram - suggest it warmly
    if (isCyrillic(telegramFirstName)) {
      // Already Cyrillic - perfect!
      welcomeMessage = `☕️ Привет! Добро пожаловать в Симанси!

Я помогу тебе заглянуть в будущее через кофейную гущу.

Я вижу, тебя зовут <b>${telegramFirstName}</b> — так и буду обращаться?

<i>Если хочешь, чтобы я называла тебя по-другому — просто напиши как.</i>`;
    } else {
      // Latin name - suggest Cyrillic version if available
      const cyrillicSuggestion = suggestCyrillicName(telegramFirstName);

      if (cyrillicSuggestion) {
        welcomeMessage = `☕️ Привет! Добро пожаловать в Симанси!

Я помогу тебе заглянуть в будущее через кофейную гущу.

Я вижу, тебя зовут ${telegramFirstName} — можно я буду называть тебя <b>${cyrillicSuggestion}</b>?

<i>Или напиши, как тебе удобнее.</i>`;
      } else {
        // Unknown Latin name - just suggest it as is
        welcomeMessage = `☕️ Привет! Добро пожаловать в Симанси!

Я помогу тебе заглянуть в будущее через кофейную гущу.

Как мне тебя называть? Я вижу <b>${telegramFirstName}</b> — так хорошо?

<i>Или напиши, как тебе удобнее.</i>`;
      }
    }
  } else {
    // No name or weird nickname - ask warmly without mentioning it
    welcomeMessage = `☕️ Привет! Добро пожаловать в Симанси!

Я помогу тебе заглянуть в будущее через кофейную гущу.

Давай познакомимся! Как мне тебя называть?

<i>Просто напиши своё имя.</i>`;
  }

  try {
    await bot.sendMessage(chatId, welcomeMessage, {
      parse_mode: "HTML",
    });

    logger.info(
      { telegramUserId, chatId, telegramFirstName, looksReal: telegramFirstName ? looksLikeRealName(telegramFirstName) : false },
      "Welcome message sent"
    );

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
