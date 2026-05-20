/**
 * Compare-photos handler module.
 *
 * Implements the two-cup comparison flow (dynamics + compatibility):
 *
 * 1. `/compare_dynamics`       — start dynamics session (pro credit, Arina)
 * 2. `/compare_compatibility`  — start compatibility session (cassandra credit, Cassandra)
 * 3. First photo               — run vision, store as `dynamics_first` / `compatibility_first`,
 *                                save analysis id in `user_states.pending_first_analysis_id`,
 *                                ask for the second photo. NO credit consumed yet.
 * 4. Second photo              — enqueue ComparePhotosJob; worker consumes the
 *                                appropriate credit and produces the interpretation.
 * 5. `/cancel_compare`         — clear pending state.
 * 6. Inline "Cancel" button    — same as /cancel_compare.
 *
 * State machine lives in `user_states`:
 *   - pending_compare_type        ('dynamics' | 'compatibility' | NULL)
 *   - pending_first_analysis_id   (UUID | NULL)
 *   - pending_compare_started_at  (TIMESTAMPTZ | NULL)
 *
 * If the session is older than COMPARE_SESSION_TTL_MS the handler resets it
 * and asks the user to start over.
 */
import { randomUUID } from "node:crypto";
import type { Job } from "pg-boss";
import type { BotContext } from "../router/middleware.js";
import type { CompareMode } from "../../types/job-schemas.js";
import type { ComparePhotosJobData } from "../../types/job-schemas.js";
import type { VisionAnalysisResult } from "../../types/langchain.js";
import { getLogger } from "../../core/logger.js";
import { getSupabase } from "../../core/database.js";
import { getBot } from "../../core/telegram.js";
import { sendComparePhotosJob } from "../../core/queue.js";
import { hasCreditsOfType } from "../credits/service.js";
import { getBotMessage, normalizeLang } from "../../services/i18n/index.js";
import {
  COMPARE_SESSION_TTL_MS,
  MODEL_VISION,
  TELEGRAM_PHOTO_SIZE_LIMIT,
} from "../../config/constants.js";
import { isMaintenanceMode } from "../config/service.js";
import { downloadAndResize, toBase64DataUrl } from "../../utils/image-processor.js";
import { analyzeVision } from "../../chains/vision.chain.js";
import { withRetry } from "../../utils/retry.js";
import { getEnv } from "../../config/env.js";
import {
  createCancelCompareKeyboard,
  COMPARE_CANCEL_CALLBACK,
} from "./keyboards.js";

const logger = getLogger().child({ module: "compare-handler" });

// ────────────────────────────────────────────────────────────────────────────
// Public API: command handlers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Handle `/compare_dynamics` command.
 *
 * Requires at least one PRO credit (no consumption yet — only at second photo).
 * Sets pending_compare_type='dynamics' and clears pending_first_analysis_id.
 */
export async function handleCompareDynamicsCommand(ctx: BotContext): Promise<void> {
  await startCompareSession(ctx, "dynamics");
}

/**
 * Handle `/compare_compatibility` command.
 *
 * Requires at least one CASSANDRA credit.
 */
export async function handleCompareCompatibilityCommand(ctx: BotContext): Promise<void> {
  await startCompareSession(ctx, "compatibility");
}

/**
 * Handle `/cancel_compare` command.
 * Idempotently clears the pending compare session.
 */
export async function handleCancelCompareCommand(ctx: BotContext): Promise<void> {
  if (!ctx.from) return;
  const telegramUserId = ctx.from.id;
  const language = getEffectiveLanguage(ctx);

  const wasActive = await isCompareSessionActive(telegramUserId);
  if (!wasActive) {
    await ctx.reply(getBotMessage("compare.nothingToCancel", language));
    return;
  }

  await clearCompareState(telegramUserId);
  await ctx.reply(getBotMessage("compare.cancelled", language));
  logger.info({ telegramUserId }, "Compare session cancelled by user");
}

/**
 * Handle the inline "Cancel comparison" button.
 * Same effect as /cancel_compare but driven by callback_query.
 */
export async function handleCompareCancelCallback(ctx: BotContext): Promise<void> {
  if (!ctx.callbackQuery?.data || !ctx.from) return;
  if (ctx.callbackQuery.data !== COMPARE_CANCEL_CALLBACK) return;

  const telegramUserId = ctx.from.id;
  const language = getEffectiveLanguage(ctx);

  await ctx.answerCallbackQuery();

  const wasActive = await isCompareSessionActive(telegramUserId);
  if (!wasActive) {
    try {
      const messageId = ctx.callbackQuery.message?.message_id;
      if (messageId && ctx.chat) {
        await ctx.api.editMessageText(
          ctx.chat.id,
          messageId,
          getBotMessage("compare.nothingToCancel", language),
        );
      }
    } catch {
      // Ignore edit failures
    }
    return;
  }

  await clearCompareState(telegramUserId);
  try {
    const messageId = ctx.callbackQuery.message?.message_id;
    if (messageId && ctx.chat) {
      await ctx.api.editMessageText(
        ctx.chat.id,
        messageId,
        getBotMessage("compare.cancelled", language),
      );
    } else {
      await ctx.reply(getBotMessage("compare.cancelled", language));
    }
  } catch {
    await ctx.reply(getBotMessage("compare.cancelled", language));
  }

  logger.info({ telegramUserId }, "Compare session cancelled via inline button");
}

// ────────────────────────────────────────────────────────────────────────────
// Public API: photo / text routing
// ────────────────────────────────────────────────────────────────────────────

/**
 * Check whether the user currently has an active compare session.
 * Cheap, single-column query. Used by the router to decide whether to
 * route the next photo through the compare flow.
 */
export async function isCompareSessionActive(telegramUserId: number): Promise<boolean> {
  const session = await loadCompareSession(telegramUserId);
  return session !== null;
}

/**
 * Handle a photo arriving while a compare session is active.
 *
 * - First photo (pending_first_analysis_id IS NULL):
 *     run vision, create dynamics_first / compatibility_first record,
 *     persist its id, ask for the second photo.
 * - Second photo (pending_first_analysis_id NOT NULL):
 *     enqueue ComparePhotosJob (worker handles credit consumption + interpretation).
 *
 * Returns true if the photo was consumed by the compare flow (caller MUST
 * skip the normal photo handler). Returns false if the photo should fall
 * through to the regular photo-analysis flow (e.g. session just expired).
 */
export async function handleComparePhoto(ctx: BotContext): Promise<boolean> {
  if (!ctx.message?.photo || !ctx.chat || !ctx.from) return false;

  const telegramUserId = ctx.from.id;
  const chatId = ctx.chat.id;
  const language = getEffectiveLanguage(ctx);

  const session = await loadCompareSession(telegramUserId);
  if (!session) {
    // Session expired or never existed → fall through to normal flow.
    return false;
  }

  // Maintenance guard
  if (await isMaintenanceMode()) {
    await ctx.reply("⚙️ Бот находится на обслуживании. Попробуйте позже.");
    return true;
  }

  const photos = ctx.message.photo;
  const photo = photos[photos.length - 1];
  if (!photo) {
    logger.warn({ telegramUserId }, "compare: empty photo array");
    return true;
  }

  // Validate size
  if (photo.file_size !== undefined && photo.file_size > TELEGRAM_PHOTO_SIZE_LIMIT) {
    logger.warn({ telegramUserId, fileSize: photo.file_size }, "compare: photo too large");
    await ctx.reply(
      "📸 Изображение слишком большое. Максимальный размер: 10 МБ.\nПопробуйте сжать фото.",
    );
    return true;
  }

  const fileId = photo.file_id;
  const messageId = ctx.message.message_id;
  const userName = ctx.profile?.name || ctx.from.username || ctx.from.first_name || undefined;

  if (session.pending_first_analysis_id) {
    // SECOND photo: enqueue compare job.
    return handleSecondPhoto(ctx, session, {
      fileId,
      messageId,
      chatId,
      telegramUserId,
      language,
      userName,
    });
  }

  // FIRST photo: run vision inline (no credit consumed) and ask for second.
  return handleFirstPhoto(ctx, session, {
    fileId,
    messageId,
    chatId,
    telegramUserId,
    language,
    userName,
  });
}

/**
 * Handle a TEXT message arriving while a compare session is active.
 * Just gently nudge the user to send a photo or cancel.
 *
 * Returns true if the text was consumed (caller MUST stop further routing).
 */
export async function handleCompareText(ctx: BotContext): Promise<boolean> {
  if (!ctx.from) return false;
  const session = await loadCompareSession(ctx.from.id);
  if (!session) return false;

  const language = getEffectiveLanguage(ctx);
  await ctx.reply(getBotMessage("compare.expectingPhoto", language));
  return true;
}

// ────────────────────────────────────────────────────────────────────────────
// Internal: shared command starter
// ────────────────────────────────────────────────────────────────────────────

async function startCompareSession(ctx: BotContext, mode: CompareMode): Promise<void> {
  if (!ctx.from) return;
  const telegramUserId = ctx.from.id;
  const language = getEffectiveLanguage(ctx);

  // 1. Credit check
  const requiredCreditType = mode === "dynamics" ? "pro" : "cassandra";
  const hasCredit = await hasCreditsOfType(telegramUserId, requiredCreditType);
  if (!hasCredit) {
    const msgKey =
      mode === "dynamics"
        ? "compare.insufficientCreditsPro"
        : "compare.insufficientCreditsCassandra";
    await ctx.reply(getBotMessage(msgKey, language));
    logger.info({ telegramUserId, mode }, "Compare session blocked: insufficient credits");
    return;
  }

  // 2. Persist pending state
  const supabase = getSupabase();
  const { error } = await supabase
    .from("user_states")
    .update({
      pending_compare_type: mode,
      pending_first_analysis_id: null,
      pending_compare_started_at: new Date().toISOString(),
    })
    .eq("telegram_user_id", telegramUserId);

  if (error) {
    logger.error({ telegramUserId, mode, error }, "Failed to set pending compare state");
    await ctx.reply(getBotMessage("error.generic", language));
    return;
  }

  // 3. Greet & ask for the first photo (with Cancel button)
  const introKey =
    mode === "dynamics" ? "compare.dynamics.start" : "compare.compatibility.start";
  await ctx.reply(getBotMessage(introKey, language), {
    reply_markup: createCancelCompareKeyboard(language),
  });

  logger.info({ telegramUserId, mode }, "Compare session started");
}

// ────────────────────────────────────────────────────────────────────────────
// Internal: first / second photo handlers
// ────────────────────────────────────────────────────────────────────────────

interface PhotoContext {
  fileId: string;
  messageId: number;
  chatId: number;
  telegramUserId: number;
  language: string;
  userName?: string | undefined;
}

interface CompareSession {
  telegram_user_id: number;
  pending_compare_type: CompareMode;
  pending_first_analysis_id: string | null;
  pending_compare_started_at: string;
}

async function handleFirstPhoto(
  ctx: BotContext,
  session: CompareSession,
  photoCtx: PhotoContext,
): Promise<boolean> {
  const { fileId, telegramUserId, language, chatId } = photoCtx;
  const mode = session.pending_compare_type;
  const bot = getBot();
  const supabase = getSupabase();

  const startTime = Date.now();
  await ctx.reply(getBotMessage("compare.processing", language));

  let analysisId: string | null = null;
  try {
    await bot.api.sendChatAction(chatId, "typing");

    // 1. Download photo from Telegram
    const file = await withRetry(() => bot.api.getFile(fileId), {
      maxAttempts: 3,
      baseDelayMs: 1000,
    });
    if (!file.file_path) {
      throw new Error("Telegram getFile did not return file_path");
    }

    const env = getEnv();
    const fileUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

    // 2. Resize + base64
    const imageBuffer = await withRetry(() => downloadAndResize(fileUrl), {
      maxAttempts: 3,
      baseDelayMs: 2000,
    });
    if (imageBuffer.length > TELEGRAM_PHOTO_SIZE_LIMIT) {
      throw new Error(`Image too large after resize: ${imageBuffer.length} bytes`);
    }
    const dataUrl = toBase64DataUrl(imageBuffer);
    const base64Image = dataUrl.replace(/^data:image\/webp;base64,/, "");

    // 3. Vision analysis (NO interpretation, NO credit consumption)
    await bot.api.sendChatAction(chatId, "typing");
    const visionResult = await withRetry(() => analyzeVision({ imageBase64: base64Image }), {
      maxAttempts: 3,
      baseDelayMs: 2000,
    });

    // 4. Persist analysis_history row (status=completed, no interpretation)
    const analysisType: "dynamics_first" | "compatibility_first" =
      mode === "dynamics" ? "dynamics_first" : "compatibility_first";
    const persona: "arina" | "cassandra" = mode === "dynamics" ? "arina" : "cassandra";
    const sessionGroupId = randomUUID();

    const { data: inserted, error: insertError } = await supabase
      .from("analysis_history")
      .insert({
        telegram_user_id: telegramUserId,
        analysis_type: analysisType,
        persona,
        topic: "all",
        status: "completed",
        session_group_id: sessionGroupId,
        vision_result: visionResult,
        vision_model_used: MODEL_VISION,
        vision_tokens_used: visionResult.tokensUsed,
        tokens_used: 0,
        processing_time_ms: Date.now() - startTime,
        completed_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      logger.error({ telegramUserId, error: insertError }, "compare: failed to persist first analysis");
      throw new Error(`Database error: ${insertError?.message || "unknown"}`);
    }
    analysisId = inserted.id;

    // 5. Update pending_first_analysis_id (refresh started_at to extend TTL)
    const { error: stateError } = await supabase
      .from("user_states")
      .update({
        pending_first_analysis_id: analysisId,
        pending_compare_started_at: new Date().toISOString(),
      })
      .eq("telegram_user_id", telegramUserId);

    if (stateError) {
      logger.error({ telegramUserId, error: stateError }, "compare: failed to update pending state");
      throw new Error(`State update error: ${stateError.message}`);
    }

    // 6. Reply "send the second photo"
    await ctx.reply(getBotMessage("compare.firstReceived", language), {
      reply_markup: createCancelCompareKeyboard(language),
    });

    logger.info(
      { telegramUserId, mode, analysisId, durationMs: Date.now() - startTime },
      "compare: first photo analyzed and stored",
    );
    return true;
  } catch (error) {
    logger.error({ telegramUserId, mode, error }, "compare: first photo processing failed");

    // Best-effort: mark the inserted analysis_history row as failed
    if (analysisId) {
      await supabase
        .from("analysis_history")
        .update({
          status: "failed",
          error_message: error instanceof Error ? error.message : String(error),
        })
        .eq("id", analysisId);
    }

    // Keep the session open so the user can retry with another first photo,
    // but make sure pending_first_analysis_id stays NULL.
    await supabase
      .from("user_states")
      .update({ pending_first_analysis_id: null })
      .eq("telegram_user_id", telegramUserId);

    await ctx.reply(getBotMessage("compare.error", language));
    return true;
  }
}

async function handleSecondPhoto(
  ctx: BotContext,
  session: CompareSession,
  photoCtx: PhotoContext,
): Promise<boolean> {
  const { fileId, messageId, chatId, telegramUserId, language, userName } = photoCtx;
  const firstAnalysisId = session.pending_first_analysis_id;
  const mode = session.pending_compare_type;

  if (!firstAnalysisId) {
    // Defensive: this should already have been handled by handleFirstPhoto.
    logger.warn({ telegramUserId }, "compare: handleSecondPhoto called without firstAnalysisId");
    return false;
  }

  // Send a quick loading message; the worker will edit it.
  let loadingMessageId: number | null = null;
  try {
    const sent = await ctx.reply(getBotMessage("compare.processing", language), {
      reply_parameters: { message_id: messageId, allow_sending_without_reply: true },
    });
    loadingMessageId = sent.message_id;
  } catch (error) {
    logger.warn({ error, telegramUserId }, "compare: failed to send loading message");
  }

  // If we couldn't send the loading message, fall back to messageId.
  const editTargetMessageId = loadingMessageId ?? messageId;

  const jobData: ComparePhotosJobData = {
    telegramUserId,
    chatId,
    messageId: editTargetMessageId,
    fileId,
    compareMode: mode,
    firstAnalysisId,
    language,
    ...(userName !== undefined ? { userName } : {}),
  };

  try {
    const jobId = await sendComparePhotosJob(jobData);
    if (!jobId) {
      throw new Error("sendComparePhotosJob returned null");
    }
    logger.info({ telegramUserId, mode, jobId, firstAnalysisId }, "compare: second-photo job enqueued");
  } catch (error) {
    logger.error({ telegramUserId, mode, error }, "compare: failed to enqueue compare job");
    await ctx.reply(getBotMessage("compare.error", language));
  }

  return true;
}

// ────────────────────────────────────────────────────────────────────────────
// Internal: state helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Load the active compare session, honoring the TTL.
 * If a stale session is found it is cleared and null is returned.
 */
async function loadCompareSession(telegramUserId: number): Promise<CompareSession | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("user_states")
    .select(
      "telegram_user_id, pending_compare_type, pending_first_analysis_id, pending_compare_started_at",
    )
    .eq("telegram_user_id", telegramUserId)
    .single();

  if (error || !data) {
    return null;
  }

  if (!data.pending_compare_type) {
    return null;
  }

  // TTL check
  if (data.pending_compare_started_at) {
    const startedAt = new Date(data.pending_compare_started_at).getTime();
    if (!Number.isNaN(startedAt) && Date.now() - startedAt > COMPARE_SESSION_TTL_MS) {
      logger.info({ telegramUserId }, "compare: session TTL expired, clearing");
      await clearCompareState(telegramUserId);
      // Notify via best-effort log only — the user will be told on next interaction
      // when the router falls through to the normal flow.
      return null;
    }
  }

  return {
    telegram_user_id: data.telegram_user_id,
    pending_compare_type: data.pending_compare_type as CompareMode,
    pending_first_analysis_id: data.pending_first_analysis_id,
    pending_compare_started_at:
      data.pending_compare_started_at ?? new Date().toISOString(),
  };
}

/**
 * Clear the pending compare session fields for a user.
 */
async function clearCompareState(telegramUserId: number): Promise<void> {
  const supabase = getSupabase();
  await supabase
    .from("user_states")
    .update({
      pending_compare_type: null,
      pending_first_analysis_id: null,
      pending_compare_started_at: null,
    })
    .eq("telegram_user_id", telegramUserId);
}

/**
 * Resolve effective language code for a user.
 */
function getEffectiveLanguage(ctx: BotContext): string {
  const raw = ctx.profile?.language_code || ctx.from?.language_code || "ru";
  return normalizeLang(raw);
}

// Type-only export used by other modules (router, worker)
export type CompareJobType = Job<ComparePhotosJobData>;
export type { VisionAnalysisResult };
