/**
 * Compare-photos worker.
 *
 * Processes ComparePhotosJob (the SECOND photo of a compare session):
 *
 *  1. Download + resize the second photo
 *  2. Run vision analysis on the second cup
 *  3. Load first cup's vision_result via firstAnalysisId
 *  4. Consume the appropriate credit (pro for dynamics, cassandra for compatibility)
 *  5. Invoke comparison.chain to produce the interpretation
 *  6. Persist analysis_history row (analysis_type=dynamics/compatibility,
 *     paired_analysis_id=firstAnalysisId, vision_result=second cup)
 *  7. Clear pending_compare_* state
 *  8. Edit the loading message with the result
 *
 * Errors:
 *   - Refund credits on any post-consumption failure.
 *   - DO NOT clear pending_compare_* if vision/credit step fails BEFORE
 *     interpretation — leave the user in the session so they can retry by
 *     sending another second photo or /cancel_compare.
 *   - Re-throw to trigger pg-boss retry for transient errors.
 */
import type { Job } from "pg-boss";
import type { Logger } from "pino";
import { getBot } from "../../core/telegram.js";
import { getSupabase } from "../../core/database.js";
import { getLogger } from "../../core/logger.js";
import { registerWorker } from "../../core/queue.js";
import { withRetry } from "../../utils/retry.js";
import { downloadAndResize, toBase64DataUrl } from "../../utils/image-processor.js";
import { analyzeVision } from "../../chains/vision.chain.js";
import { generateComparison } from "../../chains/comparison.chain.js";
import { consumeCreditsOfType, refundCreditsOfType } from "../credits/service.js";
import { sanitizeTelegramHtml } from "../../utils/html-formatter.js";
import { splitMessage } from "../../utils/message-splitter.js";
import { sendErrorAlert } from "../../utils/admin-alerts.js";
import { getBotMessage } from "../../services/i18n/index.js";
import {
  QUEUE_COMPARE_PHOTOS,
  TELEGRAM_PHOTO_SIZE_LIMIT,
  MODEL_VISION,
} from "../../config/constants.js";
import { getEnv } from "../../config/env.js";
import type { ComparePhotosJobData, CompareMode } from "../../types/job-schemas.js";
import type { VisionAnalysisResult } from "../../types/langchain.js";

const logger = getLogger().child({ module: "compare-worker" });

/**
 * Map compare mode → credit type to consume.
 */
function creditTypeFor(mode: CompareMode): "pro" | "cassandra" {
  return mode === "dynamics" ? "pro" : "cassandra";
}

/**
 * Map compare mode → persona key (for analysis_history.persona column).
 */
function personaFor(mode: CompareMode): "arina" | "cassandra" {
  return mode === "dynamics" ? "arina" : "cassandra";
}

/**
 * Validate cached vision_result JSONB structure before reuse.
 */
function isValidVisionResult(value: unknown): value is VisionAnalysisResult {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v.symbols) &&
    Array.isArray(v.colors) &&
    Array.isArray(v.patterns) &&
    typeof v.rawDescription === "string"
  );
}

/**
 * Send the interpretation to the user, editing the loading message when
 * possible, otherwise sending new messages.
 */
async function deliverInterpretation(
  chatId: number,
  loadingMessageId: number,
  rawText: string,
  jobLogger: Logger,
): Promise<void> {
  const bot = getBot();
  const safeHtml = sanitizeTelegramHtml(rawText);
  const chunks = splitMessage(safeHtml);

  if (chunks.length === 0) {
    throw new Error("splitMessage returned empty array");
  }

  if (chunks.length === 1) {
    try {
      await bot.api.editMessageText(chatId, loadingMessageId, chunks[0]!, {
        parse_mode: "HTML",
      });
      jobLogger.debug("Loading message edited with comparison result");
      return;
    } catch (editError) {
      jobLogger.warn({ error: editError }, "Failed to edit loading message, falling back to sendMessage");
      await bot.api.sendMessage(chatId, chunks[0]!, { parse_mode: "HTML" });
      return;
    }
  }

  // Multi-chunk: delete loading message, send all chunks
  try {
    await bot.api.deleteMessage(chatId, loadingMessageId);
  } catch (deleteError) {
    jobLogger.warn({ error: deleteError }, "Failed to delete loading message before multi-chunk delivery");
  }

  for (const [index, chunk] of chunks.entries()) {
    await bot.api.sendMessage(chatId, chunk, { parse_mode: "HTML" });
    jobLogger.debug({ chunk: index + 1, total: chunks.length }, "Sent comparison chunk");
  }
}

/**
 * Process a single compare-photos job.
 */
export async function processComparePhotos(job: Job<ComparePhotosJobData>): Promise<void> {
  const { telegramUserId, chatId, messageId, fileId, compareMode, firstAnalysisId, language, userName } =
    job.data;

  const jobLogger = logger.child({
    jobId: job.id,
    telegramUserId,
    chatId,
    compareMode,
    firstAnalysisId,
  });

  jobLogger.info("Starting compare-photos job");

  const startTime = Date.now();
  const bot = getBot();
  const supabase = getSupabase();

  const requiredCreditType = creditTypeFor(compareMode);
  const persona = personaFor(compareMode);

  let creditsConsumed = false;
  let secondAnalysisId: string | null = null;

  try {
    // ──────────────────────────────────────────────────────────────────
    // 1. Fetch FIRST cup's vision_result (do this early so we fail fast)
    // ──────────────────────────────────────────────────────────────────
    const { data: firstAnalysis, error: firstFetchError } = await supabase
      .from("analysis_history")
      .select("id, telegram_user_id, vision_result, session_group_id, analysis_type")
      .eq("id", firstAnalysisId)
      .single();

    if (firstFetchError || !firstAnalysis) {
      jobLogger.error({ error: firstFetchError }, "compare: first analysis not found");
      throw new Error("First analysis record not found");
    }

    // Ownership check
    if (firstAnalysis.telegram_user_id !== telegramUserId) {
      jobLogger.error(
        { actual: firstAnalysis.telegram_user_id, SECURITY_EVENT: "compare_ownership_mismatch" },
        "compare: ownership mismatch on first analysis",
      );
      await sendErrorAlert(new Error("Compare ownership mismatch"), {
        module: "compare-worker",
        telegramUserId,
        firstAnalysisId,
      });
      throw new Error("First analysis record not found");
    }

    if (!isValidVisionResult(firstAnalysis.vision_result)) {
      jobLogger.error("compare: first analysis vision_result missing or malformed");
      throw new Error("Corrupted first cup vision data");
    }

    const firstVisionResult = firstAnalysis.vision_result as VisionAnalysisResult;

    // ──────────────────────────────────────────────────────────────────
    // 2. Download + resize SECOND photo, run vision
    // ──────────────────────────────────────────────────────────────────
    await bot.api.sendChatAction(chatId, "typing");

    const file = await withRetry(() => bot.api.getFile(fileId), {
      maxAttempts: 3,
      baseDelayMs: 1000,
    });
    if (!file.file_path) {
      throw new Error("Telegram getFile did not return file_path for second photo");
    }

    const env = getEnv();
    const fileUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

    const imageBuffer = await withRetry(() => downloadAndResize(fileUrl), {
      maxAttempts: 3,
      baseDelayMs: 2000,
    });

    if (imageBuffer.length > TELEGRAM_PHOTO_SIZE_LIMIT) {
      throw new Error(`Second image too large: ${imageBuffer.length} bytes`);
    }

    const dataUrl = toBase64DataUrl(imageBuffer);
    const base64Image = dataUrl.replace(/^data:image\/webp;base64,/, "");

    await bot.api.sendChatAction(chatId, "typing");
    const secondVisionResult = await withRetry(
      () => analyzeVision({ imageBase64: base64Image }),
      { maxAttempts: 3, baseDelayMs: 2000 },
    );

    jobLogger.info(
      {
        symbolsCount: secondVisionResult.symbols.length,
        patternsCount: secondVisionResult.patterns.length,
        tokensUsed: secondVisionResult.tokensUsed,
      },
      "compare: second vision analysis completed",
    );

    // ──────────────────────────────────────────────────────────────────
    // 3. Consume credit BEFORE interpretation (atomic check + consume)
    // ──────────────────────────────────────────────────────────────────
    const consumed = await consumeCreditsOfType(telegramUserId, requiredCreditType);
    if (!consumed) {
      const insufficientKey =
        requiredCreditType === "pro"
          ? "compare.insufficientCreditsPro"
          : "compare.insufficientCreditsCassandra";
      try {
        await bot.api.editMessageText(chatId, messageId, getBotMessage(insufficientKey, language));
      } catch (editError) {
        jobLogger.warn({ error: editError }, "compare: failed to edit insufficient-credits message");
        await bot.api.sendMessage(chatId, getBotMessage(insufficientKey, language));
      }
      jobLogger.info({ requiredCreditType }, "compare: insufficient credits, aborting");
      return;
    }
    creditsConsumed = true;
    jobLogger.info({ requiredCreditType }, "compare: credit consumed");

    // ──────────────────────────────────────────────────────────────────
    // 4. Generate comparison interpretation
    // ──────────────────────────────────────────────────────────────────
    await bot.api.sendChatAction(chatId, "typing");

    const comparison = await withRetry(
      () =>
        generateComparison({
          firstVisionResult,
          secondVisionResult,
          compareMode,
          language,
          ...(userName !== undefined ? { userName } : {}),
        }),
      { maxAttempts: 3, baseDelayMs: 2000 },
    );

    jobLogger.info(
      {
        modelUsed: comparison.modelUsed,
        tokensUsed: comparison.tokensUsed,
        parseSuccess: comparison.success,
        textLength: comparison.text.length,
      },
      "compare: interpretation generated",
    );

    // ──────────────────────────────────────────────────────────────────
    // 5. Persist analysis_history row for the second cup
    // ──────────────────────────────────────────────────────────────────
    const analysisType: "dynamics" | "compatibility" =
      compareMode === "dynamics" ? "dynamics" : "compatibility";

    const processingTime = Date.now() - startTime;
    const totalTokens = secondVisionResult.tokensUsed + comparison.tokensUsed;

    const { data: inserted, error: insertError } = await supabase
      .from("analysis_history")
      .insert({
        telegram_user_id: telegramUserId,
        analysis_type: analysisType,
        persona,
        topic: "all",
        status: "completed",
        session_group_id: firstAnalysis.session_group_id,
        paired_analysis_id: firstAnalysisId,
        vision_result: secondVisionResult,
        vision_model_used: MODEL_VISION,
        vision_tokens_used: secondVisionResult.tokensUsed,
        interpretation: comparison.rawText, // store raw JSON for debugging / replay
        tokens_used: comparison.tokensUsed,
        model_used: comparison.modelUsed,
        processing_time_ms: processingTime,
        completed_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      jobLogger.error({ error: insertError }, "compare: failed to persist second analysis");
      // We already consumed credits and have the interpretation — best-effort:
      // still try to deliver to the user, then throw to trigger retry/refund.
      throw new Error(`Database error: ${insertError?.message || "unknown"}`);
    }
    secondAnalysisId = inserted.id;
    jobLogger.debug({ secondAnalysisId }, "compare: second analysis persisted");

    // ──────────────────────────────────────────────────────────────────
    // 6. Clear pending compare state
    // ──────────────────────────────────────────────────────────────────
    const { error: stateError } = await supabase
      .from("user_states")
      .update({
        pending_compare_type: null,
        pending_first_analysis_id: null,
        pending_compare_started_at: null,
        last_analysis_id: secondAnalysisId,
      })
      .eq("telegram_user_id", telegramUserId);

    if (stateError) {
      jobLogger.warn({ error: stateError }, "compare: failed to clear pending state");
      // Non-fatal — interpretation is already saved, user has it.
    }

    // ──────────────────────────────────────────────────────────────────
    // 7. Deliver result
    // ──────────────────────────────────────────────────────────────────
    await deliverInterpretation(chatId, messageId, comparison.text, jobLogger);

    jobLogger.info(
      { processingTime, totalTokens, secondAnalysisId },
      "compare: job completed successfully",
    );
  } catch (error) {
    const processingTime = Date.now() - startTime;
    jobLogger.error({ error, processingTime, creditsConsumed }, "compare: job failed");

    if (error instanceof Error) {
      await sendErrorAlert(error, {
        module: "compare-worker",
        telegramUserId,
        chatId,
        compareMode,
        firstAnalysisId,
        creditsConsumed,
      });
    }

    // Refund credit if it was consumed
    if (creditsConsumed) {
      const refunded = await refundCreditsOfType(telegramUserId, requiredCreditType);
      jobLogger.info({ refunded, requiredCreditType }, "compare: credit refund attempted");
    }

    // Mark the persisted record as failed if we had time to create it
    if (secondAnalysisId) {
      await supabase
        .from("analysis_history")
        .update({
          status: "failed",
          error_message: error instanceof Error ? error.message : String(error),
          processing_time_ms: processingTime,
        })
        .eq("id", secondAnalysisId);
    }

    // Tell the user (best-effort)
    try {
      await bot.api.editMessageText(chatId, messageId, getBotMessage("compare.error", language));
    } catch {
      try {
        await bot.api.sendMessage(chatId, getBotMessage("compare.error", language));
      } catch {
        // Ignore secondary failure
      }
    }

    // Re-throw to allow pg-boss to retry transient failures
    throw error;
  }
}

/**
 * Register the compare-photos worker with pg-boss.
 */
export async function registerCompareWorker(): Promise<string> {
  logger.info("Registering compare-photos worker");

  const workerId = await registerWorker<ComparePhotosJobData>(
    QUEUE_COMPARE_PHOTOS,
    processComparePhotos,
    {
      batchSize: 1,
      pollingIntervalSeconds: 2,
    },
  );

  logger.info({ workerId }, "Compare-photos worker registered");
  return workerId;
}
