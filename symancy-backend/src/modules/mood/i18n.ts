const moodStrings = {
  scorePrompt: {
    ru: "🌡 Как вы себя чувствуете сегодня? (1-10)",
    en: "🌡 How are you feeling today? (1-10)",
    zh: "🌡 你今天感觉怎么样？(1-10)",
  },
  error: {
    ru: "Ошибка",
    en: "Error",
    zh: "错误",
  },
  scoreSelected: {
    ru: (score: number) => `🌡 Настроение: ${score}/10\n\nКакие эмоции вы испытываете?`,
    en: (score: number) => `🌡 Mood: ${score}/10\n\nWhat emotions are you feeling?`,
    zh: (score: number) => `🌡 心情: ${score}/10\n\n你在感受什么情绪？`,
  },
  sessionExpired: {
    ru: "Сессия истекла. Отправьте /mood",
    en: "Session expired. Send /mood",
    zh: "会话已过期。请发送 /mood",
  },
  noEmotions: {
    ru: "не указаны",
    en: "none selected",
    zh: "未选择",
  },
  savedConfirmation: {
    ru: (score: number, emotionText: string) =>
      `✅ Настроение записано!\n\n🌡 Оценка: ${score}/10\n💭 Эмоции: ${emotionText}\n\nСпасибо! Это поможет сделать гадания точнее.`,
    en: (score: number, emotionText: string) =>
      `✅ Mood saved!\n\n🌡 Score: ${score}/10\n💭 Emotions: ${emotionText}\n\nThank you! This helps make readings more accurate.`,
    zh: (score: number, emotionText: string) =>
      `✅ 心情已记录！\n\n🌡 评分: ${score}/10\n💭 情绪: ${emotionText}\n\n谢谢！这有助于提高占卜准确性。`,
  },
  saved: {
    ru: "Сохранено!",
    en: "Saved!",
    zh: "已保存！",
  },
  saveError: {
    ru: "Ошибка сохранения",
    en: "Save error",
    zh: "保存失败",
  },
  saveErrorReply: {
    ru: "Не удалось сохранить настроение. Попробуйте /mood ещё раз.",
    en: "Failed to save mood. Try /mood again.",
    zh: "保存心情失败。请再试一次 /mood。",
  },
  confirmButton: {
    ru: "✅ Готово",
    en: "✅ Done",
    zh: "✅ 完成",
  },
  skipButton: {
    ru: "⏭ Пропустить",
    en: "⏭ Skip",
    zh: "⏭ 跳过",
  },
} as const;

type SupportedLang = "ru" | "en" | "zh";

/**
 * Resolve Telegram language_code to supported language.
 * Falls back to Russian (primary audience).
 */
export function resolveLang(languageCode?: string): SupportedLang {
  if (!languageCode) return "ru";
  if (languageCode.startsWith("en")) return "en";
  if (languageCode.startsWith("zh")) return "zh";
  return "ru";
}

/**
 * Get a translated string for the mood module.
 */
export function moodT(
  key: keyof typeof moodStrings,
  lang: SupportedLang,
): string | ((...args: never[]) => string) {
  return moodStrings[key][lang];
}
