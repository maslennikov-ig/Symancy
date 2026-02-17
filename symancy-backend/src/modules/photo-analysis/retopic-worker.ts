/**
 * Retopic Worker
 *
 * Background worker that processes "retopic" jobs from pg-boss queue.
 * Re-interprets coffee grounds for a different topic, reusing the cached
 * vision analysis result from a previous reading.
 *
 * Flow:
 * 1. Fetch original analysis with vision_result from database
 * 2. Create new analysis record (same session_group_id)
 * 3. Consume credits
 * 4. Generate interpretation with persona strategy (reusing vision data)
 * 5. Save to analysis_history and chat_messages
 * 6. Deliver result to user
 * 7. Show retopic keyboard with remaining topics
 * 8. On error: refund credits, send error message
 */
import type { Job } from "pg-boss";
import { getBot } from "../../core/telegram.js";
import { getSupabase } from "../../core/database.js";
import { getLogger } from "../../core/logger.js";
import { registerWorker } from "../../core/queue.js";
import { consumeCreditsOfType, refundCreditsOfType } from "../credits/service.js";
import { splitMessage } from "../../utils/message-splitter.js";
import { QUEUE_RETOPIC_PHOTO } from "../../config/constants.js";
import type { RetopicJobData } from "../../types/job-schemas.js";
import type { VisionAnalysisResult } from "../../types/langchain.js";
import { arinaStrategy } from "./personas/arina.strategy.js";
import { cassandraStrategy } from "./personas/cassandra.strategy.js";
import type { PersonaStrategy } from "./personas/arina.strategy.js";
import { withRetry } from "../../utils/retry.js";
import { sendErrorAlert } from "../../utils/admin-alerts.js";
import { createRetopicKeyboard, RETOPIC_MESSAGES } from "./keyboards.js";

const logger = getLogger().child({ module: "retopic-worker" });

/**
 * Persona strategy map
 * Maps persona names to their strategy implementations
 */
const PERSONA_STRATEGIES: Record<"arina" | "cassandra", PersonaStrategy> = {
  arina: arinaStrategy,
  cassandra: cassandraStrategy,
};

/**
 * Process retopic job
 *
 * Main worker function that handles re-interpretation of coffee grounds
 * for a different topic using the cached vision result from a previous analysis.
 *
 * @param job - pg-boss job with RetopicJobData payload
 * @throws Error on retryable failures (network, API errors)
 */
export async function processRetopicJob(job: Job<RetopicJobData>): Promise<void> {
  const { telegramUserId, chatId, messageId, analysisId, persona, topic, language, userName } = job.data;

  const jobLogger = logger.child({
    jobId: job.id,
    telegramUserId,
    analysisId,
    topic,
  });

  jobLogger.info("Starting retopic job");

  const startTime = Date.now();
  const bot = getBot();
  const supabase = getSupabase();

  // Get strategy for selected persona
  const strategy = PERSONA_STRATEGIES[persona];
  if (!strategy) {
    throw new Error(`Invalid persona: ${persona}`);
  }

  let newAnalysisId: string | null = null;
  let creditsConsumed = false;

  try {
    // Step 1: Fetch original analysis with vision_result
    jobLogger.debug("Fetching original analysis");

    const { data: originalAnalysis, error: fetchError } = await supabase
      .from("analysis_history")
      .select("vision_result, session_group_id, telegram_user_id, persona")
      .eq("id", analysisId)
      .single();

    if (fetchError || !originalAnalysis) {
      jobLogger.error({ error: fetchError }, "Failed to fetch original analysis");
      throw new Error("Original analysis not found");
    }

    // Validate ownership
    if (originalAnalysis.telegram_user_id !== telegramUserId) {
      jobLogger.error(
        { expected: telegramUserId, actual: originalAnalysis.telegram_user_id },
        "Telegram user ID mismatch"
      );
      throw new Error("Original analysis not found");
    }

    // Validate vision_result exists
    if (!originalAnalysis.vision_result) {
      jobLogger.error("Original analysis has no vision_result");
      throw new Error("Original analysis not found");
    }

    // Step 2: Parse vision_result from JSONB
    const visionResult = originalAnalysis.vision_result as VisionAnalysisResult;
    jobLogger.debug({ sessionGroupId: originalAnalysis.session_group_id }, "Original analysis fetched");

    // Step 3: Create new analysis record with same session_group_id
    const { data: newRecord, error: insertError } = await supabase
      .from("analysis_history")
      .insert({
        telegram_user_id: telegramUserId,
        analysis_type: "basic",
        persona,
        topic,
        status: "processing",
        session_group_id: originalAnalysis.session_group_id,
        vision_tokens_used: 0, // Reused, no new vision cost
      })
      .select("id")
      .single();

    if (insertError || !newRecord) {
      jobLogger.error({ error: insertError }, "Failed to create analysis record");
      throw new Error(`Database error: ${insertError?.message || "Unknown error"}`);
    }

    newAnalysisId = newRecord.id;
    jobLogger.debug({ newAnalysisId }, "New analysis record created");

    // Step 4: Consume credits
    jobLogger.debug("Checking and consuming credits");
    const consumed = await consumeCreditsOfType(telegramUserId, "basic");
    if (!consumed) {
      // Not enough credits - edit message and exit gracefully
      await bot.api.editMessageText(
        chatId,
        messageId,
        "💳 Недостаточно Basic-кредитов.\n" +
          "Пожалуйста, пополните баланс."
      );
      jobLogger.info("Insufficient credits - job aborted");
      return; // Exit gracefully, don't throw
    }
    creditsConsumed = true;
    jobLogger.info("Credits consumed");

    // Step 5: Send typing action
    await bot.api.sendChatAction(chatId, "typing");

    // Step 6: Generate interpretation with retry (reusing vision data)
    jobLogger.debug({ persona, topic }, "Generating interpretation");

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

    jobLogger.info(
      {
        interpretationTokens: interpretation.tokensUsed,
        textLength: interpretation.text.length,
      },
      "Interpretation generated"
    );

    // Step 7: Update new analysis record to completed
    const processingTime = Date.now() - startTime;

    const { error: updateError } = await supabase
      .from("analysis_history")
      .update({
        interpretation: interpretation.text,
        tokens_used: interpretation.tokensUsed,
        model_used: strategy.getModelName(),
        vision_tokens_used: 0,
        processing_time_ms: processingTime,
        status: "completed",
        completed_at: new Date().toISOString(),
        vision_result: visionResult, // Store for potential further retopics
      })
      .eq("id", newAnalysisId);

    if (updateError) {
      jobLogger.error({ error: updateError }, "Failed to update analysis record");
      // Don't throw - we already consumed credits and have the result
    } else {
      jobLogger.debug({ newAnalysisId }, "Analysis record updated");
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

    // Step 9: Deliver interpretation via splitMessage
    const messages = splitMessage(interpretation.text);

    if (messages.length === 0) {
      throw new Error("Message splitting resulted in empty array");
    }

    for (const chunk of messages) {
      await bot.api.sendMessage(chatId, chunk, { parse_mode: "HTML" });
    }
    jobLogger.debug({ chunks: messages.length }, "Interpretation delivered");

    // Step 10: Query covered topics in session group
    const { data: coveredRows } = await supabase
      .from("analysis_history")
      .select("topic")
      .eq("session_group_id", originalAnalysis.session_group_id)
      .eq("status", "completed")
      .neq("topic", "all");

    const coveredTopics = [...new Set(
      (coveredRows || []).map((r: { topic: string }) => r.topic)
    )];

    // Step 11: Show retopic keyboard with remaining topics
    const retopicKeyboard = createRetopicKeyboard(
      newAnalysisId!, coveredTopics, language
    );
    if (retopicKeyboard) {
      const msg = RETOPIC_MESSAGES[language] || RETOPIC_MESSAGES["ru"]!;
      await bot.api.sendMessage(chatId, msg, { reply_markup: retopicKeyboard });
    }

    jobLogger.info(
      { processingTime, tokensUsed: interpretation.tokensUsed, coveredTopics },
      "Retopic job completed successfully"
    );
  } catch (error) {
    const processingTime = Date.now() - startTime;
    jobLogger.error(
      { error, processingTime, creditsConsumed },
      "Retopic job failed"
    );

    // Send admin alert for critical failures
    if (error instanceof Error) {
      await sendErrorAlert(error, {
        module: "retopic-worker",
        telegramUserId,
        chatId,
        analysisId,
      });
    }

    // Refund credits if they were consumed
    if (creditsConsumed) {
      jobLogger.info("Refunding credits due to failure");
      const refunded = await refundCreditsOfType(telegramUserId, "basic");
      if (refunded) {
        jobLogger.info("Credits refunded successfully");
      } else {
        jobLogger.error("Failed to refund credits");
      }
    }

    // Update new analysis record to failed status
    if (newAnalysisId) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      await supabase
        .from("analysis_history")
        .update({
          status: "failed",
          error_message: errorMessage,
          processing_time_ms: processingTime,
        })
        .eq("id", newAnalysisId);

      jobLogger.debug({ newAnalysisId }, "Analysis record marked as failed");
    }

    // Try to send error message to user
    try {
      await bot.api.sendMessage(
        chatId,
        "Произошла ошибка при повторном анализе. Ваш кредит возвращён. Пожалуйста, попробуйте ещё раз."
      );
      jobLogger.debug("Error message sent to user");
    } catch (sendError) {
      jobLogger.warn({ error: sendError }, "Failed to send error message to user");
    }

    // Re-throw error to trigger pg-boss retry for transient errors
    throw error;
  }
}

/**
 * Register retopic worker with pg-boss
 *
 * Configures worker with appropriate settings:
 * - batchSize: 1 (process one job at a time)
 * - pollingIntervalSeconds: 2 (check for new jobs every 2 seconds)
 *
 * @returns Worker ID from pg-boss
 */
export async function registerRetopicWorker(): Promise<string> {
  logger.info("Registering retopic worker");

  const workerId = await registerWorker<RetopicJobData>(
    QUEUE_RETOPIC_PHOTO,
    processRetopicJob,
    {
      batchSize: 1,
      pollingIntervalSeconds: 2,
    }
  );

  logger.info({ workerId }, "Retopic worker registered");
  return workerId;
}
