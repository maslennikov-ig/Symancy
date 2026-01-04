/**
 * Static Insights Fallback
 *
 * Provides static insight texts for fallback when AI generation fails.
 * Matches the frontend static pool in src/services/dailyInsightService.ts
 *
 * @module modules/engagement/triggers/static-insights
 */

/**
 * Static morning advice pool per language
 * These are shown when AI generation fails
 */
const MORNING_ADVICE_POOL: Record<string, string[]> = {
  ru: [
    "✨ Сегодня хороший день обратить внимание на детали — иногда самое важное прячется именно в мелочах.",
    "🌟 День несёт в себе новые возможности. Будь открыт к неожиданным поворотам — они могут привести к чему-то прекрасному.",
    "💫 Сегодня стоит прислушаться к своей интуиции — она может подсказать верное направление.",
    "☀️ Хороший момент для начала чего-то нового. Даже маленький шаг — это движение вперёд.",
    "✨ Обрати внимание на знаки вокруг себя — вселенная может посылать тебе подсказки.",
    "🌟 Сегодня энергия благоприятствует творчеству и самовыражению. Не бойся быть собой.",
    "💫 День подходит для важных разговоров — слова найдут отклик в сердцах собеседников.",
  ],
  en: [
    "✨ Today is a good day to pay attention to details — sometimes the most important things hide in small things.",
    "🌟 The day brings new opportunities. Be open to unexpected turns — they may lead to something beautiful.",
    "💫 Today is worth listening to your intuition — it may suggest the right direction.",
    "☀️ A good moment to start something new. Even a small step is progress forward.",
    "✨ Pay attention to signs around you — the universe may be sending you hints.",
    "🌟 Today's energy favors creativity and self-expression. Don't be afraid to be yourself.",
    "💫 The day is suitable for important conversations — words will resonate in the hearts of listeners.",
  ],
  zh: [
    "✨ 今天是关注细节的好日子——有时最重要的事情就藏在小事里。",
    "🌟 这一天带来新的机会。对意外的转折保持开放——它们可能带来美好的事物。",
    "💫 今天值得倾听你的直觉——它可能会指引正确的方向。",
    "☀️ 开始新事物的好时机。即使是一小步，也是前进。",
    "✨ 注意周围的迹象——宇宙可能正在向你发送提示。",
    "🌟 今天的能量有利于创造力和自我表达。不要害怕做自己。",
    "💫 这一天适合重要的对话——言语会在听众心中产生共鸣。",
  ],
};

/**
 * Static evening insight pool per language
 */
const EVENING_INSIGHT_POOL: Record<string, string[]> = {
  ru: [
    "🌙 Как прошёл день? Надеюсь, ты нашёл время для себя. Отдохни и набирайся сил для завтра ✨",
    "🌙 Вечер — время для рефлексии. Что сегодня принесло тебе радость? Хорошего отдыха 💫",
    "🌙 День подходит к концу. Отпусти всё, что не получилось, и сохрани тёплые моменты. Спокойной ночи ✨",
  ],
  en: [
    "🌙 How was your day? I hope you found time for yourself. Rest and gather strength for tomorrow ✨",
    "🌙 Evening is a time for reflection. What brought you joy today? Have a good rest 💫",
    "🌙 The day is coming to an end. Let go of what didn't work out and keep the warm moments. Good night ✨",
  ],
  zh: [
    "🌙 今天过得怎么样？希望你找到了属于自己的时间。好好休息，为明天积蓄力量 ✨",
    "🌙 晚上是反思的时间。今天什么给你带来了快乐？好好休息 💫",
    "🌙 一天即将结束。放下没有成功的事情，保留温暖的时刻。晚安 ✨",
  ],
};

/**
 * Get a static morning insight for fallback
 * Uses day of year for rotation
 *
 * @param languageCode - User's language (ru, en, zh)
 * @returns Static morning advice text
 */
export function getStaticMorningInsight(languageCode: string): {
  text: string;
  shortText: string;
  tokensUsed: number;
  contextData: { message_ids: string[]; memory_ids: string[]; last_analysis_id: null };
} {
  // MORNING_ADVICE_POOL.ru is always defined, so this is safe
  const pool = MORNING_ADVICE_POOL[languageCode] ?? MORNING_ADVICE_POOL.ru!;
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  // Pool is guaranteed to have at least one element
  const text = pool[dayOfYear % pool.length]!;

  return {
    text,
    shortText: text.length > 100 ? text.substring(0, 97) + '...' : text,
    tokensUsed: 0, // Static, no tokens used
    contextData: {
      message_ids: [],
      memory_ids: [],
      last_analysis_id: null,
    },
  };
}

/**
 * Get a static evening insight for fallback
 *
 * @param languageCode - User's language (ru, en, zh)
 * @returns Static evening insight text
 */
export function getStaticEveningInsight(languageCode: string): {
  text: string;
  shortText: string;
  tokensUsed: number;
  contextData: { message_ids: string[]; memory_ids: string[]; last_analysis_id: null };
} {
  // EVENING_INSIGHT_POOL.ru is always defined, so this is safe
  const pool = EVENING_INSIGHT_POOL[languageCode] ?? EVENING_INSIGHT_POOL.ru!;
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  // Pool is guaranteed to have at least one element
  const text = pool[dayOfYear % pool.length]!;

  return {
    text,
    shortText: text.length > 100 ? text.substring(0, 97) + '...' : text,
    tokensUsed: 0,
    contextData: {
      message_ids: [],
      memory_ids: [],
      last_analysis_id: null,
    },
  };
}
