import type { BotContext } from "../router/middleware.js";
import { getSupabase } from "../../core/database.js";
import { getLogger } from "../../core/logger.js";
import { createScoreKeyboard, createEmotionKeyboard } from "./keyboards.js";

const logger = getLogger().child({ module: "mood" });

// In-memory flow state per user (short-lived, cleared after save)
const moodFlowState = new Map<number, { score: number; emotions: string[] }>();

/** Handle /mood command -- show score keyboard */
export async function handleMoodCommand(ctx: BotContext): Promise<void> {
  if (!ctx.from) return;

  const keyboard = createScoreKeyboard();
  await ctx.reply("🌡 Как вы себя чувствуете сегодня? (1-10)", {
    reply_markup: keyboard,
  });
  logger.info({ userId: ctx.from.id }, "Mood: score keyboard shown");
}

/** Handle mood:* callback queries */
export async function handleMoodCallback(ctx: BotContext): Promise<void> {
  if (!ctx.callbackQuery?.data || !ctx.from) return;

  const data = ctx.callbackQuery.data;
  const userId = ctx.from.id;

  // mood:score:{n}
  if (data.startsWith("mood:score:")) {
    const score = parseInt(data.split(":")[2]!, 10);
    if (isNaN(score) || score < 1 || score > 10) {
      await ctx.answerCallbackQuery({ text: "Ошибка" });
      return;
    }

    moodFlowState.set(userId, { score, emotions: [] });

    const keyboard = createEmotionKeyboard([], ctx.from.language_code);
    await ctx.editMessageText(
      `🌡 Настроение: ${score}/10\n\nКакие эмоции вы испытываете?`,
      { reply_markup: keyboard }
    );
    await ctx.answerCallbackQuery();
    logger.info({ userId, score }, "Mood: score selected");
    return;
  }

  // mood:emo:{key|confirm|skip}
  if (data.startsWith("mood:emo:")) {
    const value = data.split(":")[2]!;
    const state = moodFlowState.get(userId);

    if (!state) {
      await ctx.answerCallbackQuery({ text: "Сессия истекла. Отправьте /mood" });
      return;
    }

    if (value === "confirm" || value === "skip") {
      // Save to DB
      await saveMoodEntry(userId, state.score, state.emotions);
      moodFlowState.delete(userId);

      const emotionText = state.emotions.length > 0
        ? state.emotions.join(", ")
        : "не указаны";

      await ctx.editMessageText(
        `✅ Настроение записано!\n\n` +
        `🌡 Оценка: ${state.score}/10\n` +
        `💭 Эмоции: ${emotionText}\n\n` +
        `Спасибо! Это поможет сделать гадания точнее.`
      );
      await ctx.answerCallbackQuery({ text: "Сохранено!" });
      logger.info({ userId, score: state.score, emotions: state.emotions }, "Mood saved");
      return;
    }

    // Toggle emotion
    const idx = state.emotions.indexOf(value);
    if (idx >= 0) {
      state.emotions.splice(idx, 1);
    } else {
      state.emotions.push(value);
    }

    const keyboard = createEmotionKeyboard(state.emotions, ctx.from.language_code);
    await ctx.editMessageReplyMarkup({ reply_markup: keyboard });
    await ctx.answerCallbackQuery();
    return;
  }
}

/** Save mood to database via service role */
async function saveMoodEntry(
  telegramUserId: number,
  score: number,
  emotions: string[]
): Promise<void> {
  const supabase = getSupabase();

  // Resolve unified_user_id
  const { data: user, error: userError } = await supabase
    .from("unified_users")
    .select("id")
    .eq("telegram_id", telegramUserId)
    .single();

  if (userError || !user) {
    logger.error({ telegramUserId, error: userError }, "Failed to resolve unified user for mood");
    return;
  }

  const today = new Date().toISOString().split("T")[0];

  const { error } = await supabase
    .from("mood_entries")
    .upsert(
      {
        unified_user_id: user.id,
        date: today,
        score,
        emotions,
        source: "telegram",
      },
      { onConflict: "unified_user_id,date" }
    );

  if (error) {
    logger.error({ telegramUserId, error }, "Failed to save mood entry");
  }
}
