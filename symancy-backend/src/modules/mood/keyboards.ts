import { InlineKeyboard } from "grammy";

/** Emotion options with emoji and multilingual labels */
export const EMOTION_OPTIONS = [
  { key: "happy",     emoji: "😊", label_ru: "Радость",       label_en: "Happy",     label_zh: "快乐" },
  { key: "calm",      emoji: "😌", label_ru: "Спокойствие",   label_en: "Calm",      label_zh: "平静" },
  { key: "grateful",  emoji: "🙏", label_ru: "Благодарность", label_en: "Grateful",  label_zh: "感恩" },
  { key: "energetic", emoji: "⚡", label_ru: "Энергия",       label_en: "Energetic", label_zh: "精力充沛" },
  { key: "loved",     emoji: "❤️", label_ru: "Любовь",       label_en: "Loved",     label_zh: "被爱" },
  { key: "hopeful",   emoji: "🌈", label_ru: "Надежда",      label_en: "Hopeful",   label_zh: "充满希望" },
  { key: "anxious",   emoji: "😰", label_ru: "Тревога",      label_en: "Anxious",   label_zh: "焦虑" },
  { key: "sad",       emoji: "😔", label_ru: "Грусть",       label_en: "Sad",       label_zh: "悲伤" },
  { key: "angry",     emoji: "😠", label_ru: "Злость",       label_en: "Angry",     label_zh: "生气" },
  { key: "tired",     emoji: "😩", label_ru: "Усталость",    label_en: "Tired",     label_zh: "疲惫" },
  { key: "stressed",  emoji: "🤯", label_ru: "Стресс",       label_en: "Stressed",  label_zh: "有压力" },
  { key: "lonely",    emoji: "🧑", label_ru: "Одиночество",  label_en: "Lonely",    label_zh: "孤独" },
] as const;

/**
 * Create mood score keyboard (1-10)
 * Callback data format: mood:score:{value}
 */
export function createScoreKeyboard(): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  // Row 1: scores 1-5
  keyboard
    .text("1 😞", "mood:score:1")
    .text("2 😕", "mood:score:2")
    .text("3 😐", "mood:score:3")
    .text("4 🙂", "mood:score:4")
    .text("5 😊", "mood:score:5");
  keyboard.row();
  // Row 2: scores 6-10
  keyboard
    .text("6 😄", "mood:score:6")
    .text("7 😁", "mood:score:7")
    .text("8 🤩", "mood:score:8")
    .text("9 🥰", "mood:score:9")
    .text("10 🌟", "mood:score:10");
  return keyboard;
}

/**
 * Create emotion picker keyboard with toggle state
 * Callback data format: mood:emo:{key}
 */
export function createEmotionKeyboard(
  selectedEmotions: string[] = [],
  language: string = "ru"
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  for (let i = 0; i < EMOTION_OPTIONS.length; i += 2) {
    const opt1 = EMOTION_OPTIONS[i]!;
    const opt2 = EMOTION_OPTIONS[i + 1];

    const sel1 = selectedEmotions.includes(opt1.key);
    keyboard.text(formatEmoLabel(opt1, language, sel1), `mood:emo:${opt1.key}`);

    if (opt2) {
      const sel2 = selectedEmotions.includes(opt2.key);
      keyboard.text(formatEmoLabel(opt2, language, sel2), `mood:emo:${opt2.key}`);
    }
    keyboard.row();
  }

  // Action buttons
  if (selectedEmotions.length > 0) {
    keyboard.text("✅ Готово", "mood:emo:confirm");
  }
  keyboard.text("⏭ Пропустить", "mood:emo:skip");
  return keyboard;
}

function formatEmoLabel(
  opt: typeof EMOTION_OPTIONS[number],
  lang: string,
  selected: boolean
): string {
  const check = selected ? "✓ " : "";
  const label = lang === "en" ? opt.label_en : lang === "zh" ? opt.label_zh : opt.label_ru;
  return `${check}${opt.emoji} ${label}`;
}
