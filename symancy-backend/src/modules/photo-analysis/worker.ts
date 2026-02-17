/**
 * Photo Analysis Worker
 *
 * Background worker that processes photo analysis jobs from pg-boss queue.
 * Downloads Telegram photos, runs vision analysis, generates interpretation,
 * saves to database, and sends results to users.
 *
 * Flow:
 * 1. Download photo from Telegram
 * 2. Resize image (800x800 max, WebP)
 * 3. Run vision analysis (Claude Vision)
 * 4. Generate interpretation with persona
 * 5. Consume credits
 * 6. Save to analysis_history and chat_messages
 * 7. Edit loading message with result
 * 8. On error: refund credits, send error message
 */
import type { Job } from "pg-boss";
import { getBot } from "../../core/telegram.js";
import { getSupabase } from "../../core/database.js";
import { getLogger } from "../../core/logger.js";
import { registerWorker } from "../../core/queue.js";
import { downloadAndResize, toBase64DataUrl } from "../../utils/image-processor.js";
import { analyzeVision } from "../../chains/vision.chain.js";
import { validateCoffeeGrounds } from "../../chains/validation.chain.js";
import { consumeCreditsOfType, refundCreditsOfType } from "../credits/service.js";
import { splitMessage } from "../../utils/message-splitter.js";
import {
  QUEUE_ANALYZE_PHOTO,
  TELEGRAM_PHOTO_SIZE_LIMIT,
  REJECTION_CONFIDENCE_THRESHOLD,
  MAX_DAILY_INVALID_RESPONSES,
  MODEL_VISION,
  getInvalidImageFallback,
} from "../../config/constants.js";
import { generateInvalidImageResponse } from "../../chains/chat.chain.js";
import type { PhotoAnalysisJobData } from "../../types/telegram.js";
import { arinaStrategy } from "./personas/arina.strategy.js";
import { cassandraStrategy } from "./personas/cassandra.strategy.js";
import type { PersonaStrategy } from "./personas/arina.strategy.js";
import { withRetry } from "../../utils/retry.js";
import { sendErrorAlert } from "../../utils/admin-alerts.js";
import { savePhoto } from "./storage.service.js";
import { getEnv } from "../../config/env.js";
import { randomUUID } from "node:crypto";
import { createRetopicKeyboard, RETOPIC_MESSAGES } from "./keyboards.js";

const logger = getLogger().child({ module: "photo-analysis-worker" });

/**
 * Persona strategy map
 * Maps persona names to their strategy implementations
 */
const PERSONA_STRATEGIES: Record<"arina" | "cassandra", PersonaStrategy> = {
  arina: arinaStrategy,
  cassandra: cassandraStrategy,
};

/**
 * Valid topic values for defense-in-depth validation
 */
const VALID_TOPICS = new Set(["love", "career", "money", "health", "family", "spiritual", "all"]);

/**
 * Process photo analysis job
 *
 * Main worker function that handles the complete photo analysis pipeline:
 * - Downloads and processes image
 * - Runs AI vision and interpretation
 * - Manages credit transactions
 * - Persists results to database
 * - Updates user with final interpretation
 *
 * @param job - pg-boss job with PhotoAnalysisJobData payload
 * @throws Error on retryable failures (network, API errors)
 */
export async function processPhotoAnalysis(job: Job<PhotoAnalysisJobData>): Promise<void> {
  const { telegramUserId, chatId, messageId, fileId, persona, language, userName, topic: rawTopic = "all", creditType = "basic" } = job.data;

  // Validate topic (defense-in-depth, Zod schema should catch invalid values at queue entry)
  const topic = VALID_TOPICS.has(rawTopic) ? rawTopic : "all";
  if (rawTopic !== topic) {
    logger.warn({ rawTopic, validatedTopic: topic }, "Invalid topic in job data, falling back to 'all'");
  }

  const jobLogger = logger.child({
    jobId: job.id,
    telegramUserId,
    chatId,
    fileId,
    persona,
    topic,
  });

  jobLogger.info("Starting photo analysis");

  const startTime = Date.now();
  const bot = getBot();
  const supabase = getSupabase();

  // Get strategy for selected persona
  const strategy = PERSONA_STRATEGIES[persona];
  if (!strategy) {
    throw new Error(`Invalid persona: ${persona}`);
  }

  const modelName = strategy.getModelName();

  let analysisId: string | null = null;
  let creditsConsumed = false;
  const sessionGroupId = randomUUID();

  try {
    // Create analysis record with "processing" status
    const { data: analysisRecord, error: insertError } = await supabase
      .from("analysis_history")
      .insert({
        telegram_user_id: telegramUserId,
        analysis_type: creditType === "pro" ? "pro" : "basic",
        persona,
        topic,
        status: "processing",
        session_group_id: sessionGroupId,
      })
      .select("id")
      .single();

    if (insertError || !analysisRecord) {
      jobLogger.error({ error: insertError }, "Failed to create analysis record");
      throw new Error(`Database error: ${insertError?.message || "Unknown error"}`);
    }

    analysisId = analysisRecord.id;
    jobLogger.debug({ analysisId }, "Analysis record created");

    // Step 1: Download photo from Telegram (with retry)
    jobLogger.debug("Downloading photo from Telegram");
    await bot.api.sendChatAction(chatId, "typing");

    const file = await withRetry(() => bot.api.getFile(fileId), {
      maxAttempts: 3,
      baseDelayMs: 1000,
    });
    if (!file.file_path) {
      throw new Error("File path not found in Telegram response");
    }

    const env = getEnv();
    const fileUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
    jobLogger.debug({ fileUrl }, "Got Telegram file URL");

    // Step 2: Download and resize image (with retry)
    jobLogger.debug("Downloading and resizing image");
    const imageBuffer = await withRetry(() => downloadAndResize(fileUrl), {
      maxAttempts: 3,
      baseDelayMs: 2000,
    });
    jobLogger.info({ bufferSize: imageBuffer.length }, "Image downloaded and resized");

    // Validate downloaded image size
    if (imageBuffer.length > TELEGRAM_PHOTO_SIZE_LIMIT) {
      jobLogger.error(
        { bufferSize: imageBuffer.length, limit: TELEGRAM_PHOTO_SIZE_LIMIT },
        "Downloaded image exceeds size limit"
      );
      throw new Error(`Image too large: ${imageBuffer.length} bytes (max: ${TELEGRAM_PHOTO_SIZE_LIMIT})`);
    }

    // Step 2.5: Save photo to disk for future reference
    if (analysisId) {
      try {
        const photoPath = await savePhoto(imageBuffer, {
          userId: telegramUserId,
          analysisId,
          analysisType: persona === "cassandra" ? "cassandra" : "basic",
        });
        jobLogger.debug({ photoPath }, "Photo saved to disk");
      } catch (storageError) {
        // Non-blocking: Log error but continue with analysis
        jobLogger.warn({ error: storageError }, "Failed to save photo to disk");
      }
    }

    // Step 3: Convert to base64 data URL
    const dataUrl = toBase64DataUrl(imageBuffer);
    // Extract just the base64 part (vision API expects base64 without data URL prefix)
    const base64Image = dataUrl.replace(/^data:image\/webp;base64,/, "");
    jobLogger.debug({ base64Length: base64Image.length }, "Image converted to base64");

    // Step 3.5: Validate image contains coffee grounds (troll protection)
    jobLogger.debug("Validating image content");
    await bot.api.sendChatAction(chatId, "typing");

    const validationResult = await withRetry(
      () => validateCoffeeGrounds({ imageBase64: base64Image }),
      {
        maxAttempts: 2, // Fewer retries for validation
        baseDelayMs: 1000,
      }
    );

    jobLogger.info(
      {
        isValid: validationResult.isValid,
        category: validationResult.category,
        confidence: validationResult.confidence,
      },
      "Image validation completed"
    );

    // Check if image should be rejected
    // IMPORTANT: We only reject if we're CONFIDENT it's NOT coffee grounds
    // When in doubt, we ALWAYS proceed with analysis (false rejection is worse than false acceptance)
    const shouldReject =
      !validationResult.isValid &&
      validationResult.confidence >= REJECTION_CONFIDENCE_THRESHOLD;

    if (shouldReject) {
      // Update analysis record to rejected
      const { error: rejectUpdateError } = await supabase
        .from("analysis_history")
        .update({
          status: "rejected",
          error_message: `Validation failed: ${validationResult.category} (confidence: ${validationResult.confidence.toFixed(2)})`,
          processing_time_ms: Date.now() - startTime,
        })
        .eq("id", analysisId);

      if (rejectUpdateError) {
        jobLogger.error({ error: rejectUpdateError }, "Failed to mark analysis as rejected");
      }

      // Get current invalid count using atomic SQL function (handles UTC day reset)
      const { data: countData, error: countError } = await supabase
        .rpc("get_invalid_count", { p_telegram_user_id: telegramUserId });

      if (countError) {
        jobLogger.error({ error: countError }, "Failed to get invalid count, using fallback");
      }

      const currentInvalidCount = countError ? 0 : (countData as number);
      let rejectionMessage: string;
      let usedPersonalizedResponse = false;

      if (currentInvalidCount < MAX_DAILY_INVALID_RESPONSES) {
        // Within limit: generate personalized response via chat model
        jobLogger.debug(
          { currentInvalidCount, maxAllowed: MAX_DAILY_INVALID_RESPONSES },
          "Generating personalized invalid image response"
        );

        try {
          const chatResponse = await withRetry(
            () => generateInvalidImageResponse(
              validationResult.description, // English description from validation
              { language: language || "ru", userName }
            ),
            { maxAttempts: 2, baseDelayMs: 1000 }
          );
          rejectionMessage = chatResponse.text;
          usedPersonalizedResponse = true;
        } catch (chatError) {
          // Fallback if chat generation fails - DON'T increment counter
          jobLogger.warn({ error: chatError }, "Chat response generation failed, using fallback");
          rejectionMessage = getInvalidImageFallback(language || "ru");
          usedPersonalizedResponse = false;
        }
      } else {
        // Exceeded limit: use simple fallback (no API cost)
        jobLogger.info(
          { currentInvalidCount },
          "Daily invalid limit exceeded, using fallback message"
        );
        rejectionMessage = getInvalidImageFallback(language || "ru");
      }

      // Only increment counter if we used a personalized response
      // Uses atomic SQL function to prevent race conditions
      let finalCount = currentInvalidCount;
      if (usedPersonalizedResponse) {
        const { data: incrementData, error: incrementError } = await supabase
          .rpc("increment_invalid_count", { p_telegram_user_id: telegramUserId });

        if (incrementError) {
          jobLogger.error({ error: incrementError }, "Failed to increment invalid count");
        } else if (incrementData && incrementData.length > 0) {
          finalCount = incrementData[0].new_count;
          jobLogger.debug(
            { newCount: finalCount, wasReset: incrementData[0].was_reset },
            "Invalid count incremented"
          );
        }
      }

      await bot.api.editMessageText(chatId, messageId, rejectionMessage);

      jobLogger.info(
        {
          category: validationResult.category,
          confidence: validationResult.confidence,
          dailyInvalidCount: finalCount,
          usedPersonalized: usedPersonalizedResponse,
        },
        "Image rejected - confident this is not coffee grounds"
      );

      // Exit without consuming credits
      return;
    }

    // If we're here, proceed with analysis (either valid OR uncertain)
    if (!validationResult.isValid) {
      jobLogger.info(
        {
          category: validationResult.category,
          confidence: validationResult.confidence,
        },
        "Uncertain validation - proceeding with analysis (benefit of doubt)"
      );
    }

    // Step 4: Run vision analysis (with retry)
    jobLogger.debug("Running vision analysis");
    await bot.api.sendChatAction(chatId, "typing");

    const visionResult = await withRetry(
      () => analyzeVision({ imageBase64: base64Image }),
      {
        maxAttempts: 3,
        baseDelayMs: 2000,
      }
    );
    jobLogger.info(
      {
        symbolsCount: visionResult.symbols.length,
        colorsCount: visionResult.colors.length,
        patternsCount: visionResult.patterns.length,
        tokensUsed: visionResult.tokensUsed,
      },
      "Vision analysis completed"
    );

    // Step 4.5: Check and consume credits BEFORE generating interpretation
    // This is atomic and prevents race conditions from handler-level checks
    // Uses creditType from job data (basic for single topic, pro for "all")
    jobLogger.debug({ creditType }, "Checking and consuming credits");
    const consumed = await consumeCreditsOfType(telegramUserId, creditType);
    if (!consumed) {
      // Not enough credits - update message and exit gracefully
      const creditLabel = creditType === "pro" ? "Pro" : "Basic";
      await bot.api.editMessageText(
        chatId,
        messageId,
        `💳 Недостаточно ${creditLabel}-кредитов.\n` +
          "Пожалуйста, пополните баланс."
      );
      jobLogger.info({ creditType }, "Insufficient credits - job aborted");
      return; // Exit gracefully, don't throw
    }
    creditsConsumed = true;
    jobLogger.info({ creditType }, "Credits consumed");

    // Step 5: Generate interpretation with persona using strategy (with retry)
    jobLogger.debug({ persona, topic }, "Generating interpretation");
    await bot.api.sendChatAction(chatId, "typing");

    const interpretation = await withRetry(
      () =>
        strategy.interpret(visionResult, {
          language: language || "ru",
          userName,
          topic,
        }),
      {
        maxAttempts: 3,
        baseDelayMs: 2000,
      }
    );

    // Calculate total tokens (vision + interpretation)
    const totalTokensUsed = visionResult.tokensUsed + interpretation.tokensUsed;

    jobLogger.info(
      {
        visionTokens: visionResult.tokensUsed,
        interpretationTokens: interpretation.tokensUsed,
        totalTokens: totalTokensUsed,
        textLength: interpretation.text.length,
      },
      "Interpretation generated"
    );

    // Step 7: Save interpretation to analysis_history
    const processingTime = Date.now() - startTime;

    const { error: updateError } = await supabase
      .from("analysis_history")
      .update({
        interpretation: interpretation.text,
        tokens_used: interpretation.tokensUsed, // Interpretation model tokens only
        model_used: modelName,
        vision_model_used: MODEL_VISION, // Vision model name
        vision_tokens_used: visionResult.tokensUsed, // Vision model tokens
        processing_time_ms: processingTime,
        status: "completed",
        completed_at: new Date().toISOString(),
        vision_result: visionResult, // Cache for retopic feature
      })
      .eq("id", analysisId);

    if (updateError) {
      jobLogger.error({ error: updateError }, "Failed to update analysis record");
      // Don't throw - we already consumed credits and have the result
    } else {
      jobLogger.debug({ analysisId }, "Analysis record updated");
    }

    // Step 8: Save to chat_messages (assistant response)
    const { error: chatError } = await supabase.from("chat_messages").insert({
      telegram_user_id: telegramUserId,
      role: "assistant",
      content: interpretation.text,
    });

    if (chatError) {
      jobLogger.warn({ error: chatError }, "Failed to save chat message");
      // Don't throw - result is already saved in analysis_history
    } else {
      jobLogger.debug("Chat message saved");
    }

    // Step 9: Update user state with last analysis
    const { error: stateError } = await supabase
      .from("user_states")
      .upsert({
        telegram_user_id: telegramUserId,
        last_analysis_id: analysisId,
      })
      .select();

    if (stateError) {
      jobLogger.warn({ error: stateError }, "Failed to update user state");
      // Don't throw - non-critical
    }

    // Step 10: Edit loading message with interpretation result
    const resultText = interpretation.text;

    // Split message if longer than Telegram limit
    const messages = splitMessage(resultText);

    if (messages.length === 0) {
      throw new Error("Message splitting resulted in empty array");
    }

    if (messages.length === 1) {
      // Single message: edit the loading message
      await bot.api.editMessageText(chatId, messageId, messages[0]!, {
        parse_mode: "HTML",
      });
      jobLogger.debug("Loading message edited with result");
    } else {
      // Multiple messages: delete loading message, send chunks
      jobLogger.info({ chunks: messages.length }, "Message split into chunks");

      await bot.api.deleteMessage(chatId, messageId);
      jobLogger.debug("Loading message deleted");

      for (const [index, chunk] of messages.entries()) {
        await bot.api.sendMessage(chatId, chunk, {
          parse_mode: "HTML",
        });
        jobLogger.debug({ chunk: index + 1, total: messages.length }, "Sent message chunk");
      }
    }

    // After single-topic delivery, show retopic keyboard
    if (topic !== "all" && analysisId) {
      try {
        const retopicKeyboard = createRetopicKeyboard(analysisId, [topic], language || "ru");
        if (retopicKeyboard) {
          const retopicMsg = RETOPIC_MESSAGES[language || "ru"] || RETOPIC_MESSAGES["ru"]!;
          await bot.api.sendMessage(chatId, retopicMsg, { reply_markup: retopicKeyboard });
          jobLogger.debug("Retopic keyboard sent");
        }
      } catch (retopicError) {
        jobLogger.warn({ error: retopicError }, "Failed to send retopic keyboard");
        // Non-blocking: don't fail the job if retopic keyboard fails
      }
    }

    jobLogger.info(
      { processingTime, tokensUsed: totalTokensUsed },
      "Photo analysis completed successfully"
    );
  } catch (error) {
    const processingTime = Date.now() - startTime;
    jobLogger.error(
      { error, processingTime, creditsConsumed },
      "Photo analysis failed"
    );

    // Send admin alert for critical failures
    if (error instanceof Error) {
      await sendErrorAlert(error, {
        module: "photo-analysis",
        telegramUserId,
        chatId,
        fileId,
        persona,
        creditsConsumed,
      });
    }

    // Refund credits if they were consumed (using correct credit type)
    if (creditsConsumed) {
      jobLogger.info({ creditType }, "Refunding credits due to failure");
      const refunded = await refundCreditsOfType(telegramUserId, creditType);
      if (refunded) {
        jobLogger.info({ creditType }, "Credits refunded successfully");
      } else {
        jobLogger.error({ creditType }, "Failed to refund credits");
      }
    }

    // Update analysis record to failed status
    if (analysisId) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      await supabase
        .from("analysis_history")
        .update({
          status: "failed",
          error_message: errorMessage,
          processing_time_ms: processingTime,
        })
        .eq("id", analysisId);

      jobLogger.debug({ analysisId }, "Analysis record marked as failed");
    }

    // Update loading message with error
    try {
      await bot.api.editMessageText(
        chatId,
        messageId,
        "Произошла ошибка при анализе изображения. Ваш кредит возвращён. Пожалуйста, попробуйте ещё раз."
      );
      jobLogger.debug("Loading message updated with error");
    } catch (editError) {
      jobLogger.warn({ error: editError }, "Failed to edit loading message with error");
    }

    // Re-throw error to trigger pg-boss retry for transient errors
    // Network errors, API timeouts, etc. should be retried
    throw error;
  }
}

/**
 * Register photo analysis worker with pg-boss
 *
 * Configures worker with appropriate concurrency settings:
 * - teamSize: 2 (2 parallel workers)
 * - batchSize: 1 (process one job at a time per worker)
 *
 * @returns Worker ID from pg-boss
 */
export async function registerPhotoWorker(): Promise<string> {
  logger.info("Registering photo analysis worker");

  const workerId = await registerWorker<PhotoAnalysisJobData>(
    QUEUE_ANALYZE_PHOTO,
    processPhotoAnalysis,
    {
      batchSize: 1, // Process one job at a time
      pollingIntervalSeconds: 2, // Check for new jobs every 2 seconds
      // Note: retry settings are defined in queue.ts sendJob function
    }
  );

  logger.info({ workerId }, "Photo analysis worker registered");
  return workerId;
}
