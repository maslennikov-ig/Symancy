/**
 * Chat Reply Worker
 *
 * Background worker that processes chat reply jobs from pg-boss queue.
 * Generates AI responses with conversation history context, manages credits,
 * and tracks daily message limits.
 *
 * Flow:
 * 1. Check and update daily message limit
 * 2. Save user message to chat_messages
 * 3. Show typing indicator
 * 4. Generate AI response with history context
 * 5. Save assistant response to chat_messages
 * 6. Consume credits
 * 7. Send response to user (with message splitting if needed)
 * 8. Increment daily message counter
 * 9. On error: refund credits, send error message
 */
import type { JobWithMetadata } from "pg-boss";
import { getBot } from "../../core/telegram.js";
import { getSupabase } from "../../core/database.js";
import { getLogger } from "../../core/logger.js";
import { registerWorkerWithMetadata } from "../../core/queue.js";
import { generateChatResponseDirect } from "../../chains/chat.chain.js";
import { consumeCredits, refundCredits } from "../credits/service.js";
import { splitMessage } from "../../utils/message-splitter.js";
import { QUEUE_CHAT_REPLY, DAILY_CHAT_LIMIT } from "../../config/constants.js";
import type { ChatReplyJobData } from "../../types/telegram.js";
import { withRetry } from "../../utils/retry.js";
import { sendErrorAlert } from "../../utils/admin-alerts.js";
import { extractMemories } from "../../chains/memory-extraction.chain.js";
import { addMemory } from "../../services/memory.service.js";

const logger = getLogger().child({ module: "chat-worker" });

/**
 * Message when daily limit is reached during processing
 */
const LIMIT_REACHED_MESSAGE =
  "📊 Вы достигли лимита сообщений на сегодня (50 сообщений).\n" +
  "Лимит обновится завтра. Вы также можете отправить фото для нового гадания.";

/**
 * Check and update daily message limit
 * Resets counter if it's a new day
 *
 * @param telegramUserId - Telegram user ID
 * @returns Object with allowed flag and remaining count
 */
async function checkAndUpdateDailyLimit(
  telegramUserId: number
): Promise<{ allowed: boolean; remaining: number }> {
  const supabase = getSupabase();

  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format

  // Get or create user state
  const { data: userState, error: fetchError } = await supabase
    .from("user_states")
    .select("daily_messages_count, last_message_date")
    .eq("telegram_user_id", telegramUserId)
    .single();

  if (fetchError && fetchError.code !== "PGRST116") {
    // PGRST116 = no rows returned
    logger.error(
      { error: fetchError, telegramUserId },
      "Failed to fetch user state for daily limit"
    );
    throw new Error("Failed to check daily limit");
  }

  // If no state or different day, reset counter
  if (
    !userState ||
    !userState.last_message_date ||
    userState.last_message_date !== today
  ) {
    // Reset counter for new day
    const { error: upsertError } = await supabase
      .from("user_states")
      .upsert({
        telegram_user_id: telegramUserId,
        daily_messages_count: 0,
        last_message_date: today,
      })
      .select();

    if (upsertError) {
      logger.error(
        { error: upsertError, telegramUserId },
        "Failed to reset daily message count"
      );
      throw new Error("Failed to reset daily limit");
    }

    logger.debug({ telegramUserId }, "Reset daily message count for new day");
    return { allowed: true, remaining: DAILY_CHAT_LIMIT };
  }

  // Same day - check count
  const count = userState.daily_messages_count || 0;

  if (count >= DAILY_CHAT_LIMIT) {
    logger.info({ telegramUserId, count }, "User reached daily message limit");
    return { allowed: false, remaining: 0 };
  }

  const remaining = DAILY_CHAT_LIMIT - count;
  logger.debug({ telegramUserId, count, remaining }, "Daily limit check passed");

  return { allowed: true, remaining };
}

/**
 * Increment daily message counter
 *
 * @param telegramUserId - Telegram user ID
 */
async function incrementDailyMessageCount(
  telegramUserId: number
): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase.rpc("increment_daily_messages", {
    p_telegram_user_id: telegramUserId,
  });

  if (error) {
    // Try fallback manual increment if RPC doesn't exist yet
    logger.warn(
      { error, telegramUserId },
      "RPC increment_daily_messages failed, using fallback"
    );

    // Fallback: fetch current count, then update
    const { data: currentState } = await supabase
      .from("user_states")
      .select("daily_messages_count")
      .eq("telegram_user_id", telegramUserId)
      .single();

    const currentCount = currentState?.daily_messages_count || 0;

    const { error: updateError } = await supabase
      .from("user_states")
      .update({
        daily_messages_count: currentCount + 1,
      })
      .eq("telegram_user_id", telegramUserId);

    if (updateError) {
      logger.error(
        { error: updateError, telegramUserId },
        "Failed to increment daily message count (fallback)"
      );
      // Don't throw - non-critical
    } else {
      logger.debug({ telegramUserId }, "Incremented daily message count (fallback)");
    }
  } else {
    logger.debug({ telegramUserId }, "Incremented daily message count");
  }
}

/**
 * Process chat reply job
 *
 * Main worker function that handles the complete chat pipeline:
 * - Validates daily limits
 * - Generates AI responses with history
 * - Manages credit transactions
 * - Persists messages to database
 * - Updates user with response
 *
 * @param job - pg-boss job with ChatReplyJobData payload
 * @throws Error on retryable failures (network, API errors)
 */
export async function processChatReply(job: JobWithMetadata<ChatReplyJobData>): Promise<void> {
  const { telegramUserId, chatId, messageId, text } = job.data;

  const jobLogger = logger.child({
    jobId: job.id,
    telegramUserId,
    chatId,
  });

  jobLogger.info("Starting chat reply processing");

  const startTime = Date.now();
  const bot = getBot();
  const supabase = getSupabase();

  let creditsConsumed = false;

  try {
    // Step 1: Check daily limit (before processing)
    const { allowed, remaining } = await checkAndUpdateDailyLimit(telegramUserId);

    if (!allowed) {
      jobLogger.info("User reached daily limit during processing");
      await bot.api.sendMessage(chatId, LIMIT_REACHED_MESSAGE, {
        reply_parameters: { message_id: messageId },
      });
      return; // Exit without error (limit reached is not a failure)
    }

    jobLogger.debug({ remaining }, "Daily limit check passed");

    // Step 2: Save user message to chat_messages
    const { error: userMessageError } = await supabase
      .from("chat_messages")
      .insert({
        telegram_user_id: telegramUserId,
        role: "user",
        content: text,
      });

    if (userMessageError) {
      jobLogger.error({ error: userMessageError }, "Failed to save user message");
      throw new Error(`Failed to save user message: ${userMessageError.message}`);
    }

    jobLogger.debug("User message saved to chat_messages");

    // Step 3: Show typing indicator
    await bot.api.sendChatAction(chatId, "typing");

    // Step 4: Generate AI response with conversation history (with retry)
    jobLogger.debug("Generating chat response");

    const response = await withRetry(
      () => generateChatResponseDirect(text, telegramUserId),
      {
        maxAttempts: 3,
        baseDelayMs: 2000,
      }
    );

    jobLogger.info(
      { tokensUsed: response.tokensUsed, textLength: response.text.length },
      "Chat response generated"
    );

    // Step 5: Save assistant response to chat_messages
    const { error: assistantMessageError } = await supabase
      .from("chat_messages")
      .insert({
        telegram_user_id: telegramUserId,
        role: "assistant",
        content: response.text,
      });

    if (assistantMessageError) {
      jobLogger.warn(
        { error: assistantMessageError },
        "Failed to save assistant message"
      );
      // Don't throw - we already have the response
    } else {
      jobLogger.debug("Assistant message saved to chat_messages");
    }

    // Step 6: Consume credits BEFORE sending response
    jobLogger.debug("Consuming credits");
    const consumed = await consumeCredits(telegramUserId, 1);
    if (!consumed) {
      throw new Error("Failed to consume credits");
    }
    creditsConsumed = true;
    jobLogger.info("Credits consumed");

    // Step 7: Send response to user (with message splitting if needed)
    const messages = splitMessage(response.text);

    if (messages.length === 0) {
      throw new Error("Message splitting resulted in empty array");
    }

    // Send all message chunks
    for (const [index, chunk] of messages.entries()) {
      const isFirst = index === 0;

      await bot.api.sendMessage(chatId, chunk, {
        parse_mode: "HTML",
        reply_parameters: isFirst ? { message_id: messageId } : undefined,
      });

      if (messages.length > 1) {
        jobLogger.debug(
          { chunk: index + 1, total: messages.length },
          "Sent message chunk"
        );
      }
    }

    if (messages.length === 1) {
      jobLogger.debug("Chat response sent");
    } else {
      jobLogger.info({ chunks: messages.length }, "Chat response sent in chunks");
    }

    // Step 7.5: Extract and save memories (async, non-blocking)
    (async () => {
      try {
        const extracted = await extractMemories(text);
        if (extracted.hasMemories && extracted.memories.length > 0) {
          for (const mem of extracted.memories) {
            await addMemory(telegramUserId, mem.content, mem.category, text);
          }
          jobLogger.debug({ count: extracted.memories.length }, "Memories extracted and saved");
        }
      } catch (error) {
        jobLogger.warn({ error }, "Failed to extract memories (non-critical)");
      }
    })();

    // Step 8: Increment daily message counter
    await incrementDailyMessageCount(telegramUserId);

    const processingTime = Date.now() - startTime;
    jobLogger.info(
      { processingTime, tokensUsed: response.tokensUsed },
      "Chat reply completed successfully"
    );
  } catch (error) {
    const processingTime = Date.now() - startTime;
    jobLogger.error({ error, processingTime, creditsConsumed }, "Chat reply failed");

    // Send admin alert for critical failures
    if (error instanceof Error) {
      await sendErrorAlert(error, {
        module: "chat-reply",
        telegramUserId,
        chatId,
        messageText: text,
        creditsConsumed,
      });
    }

    // Refund credits if they were consumed
    if (creditsConsumed) {
      jobLogger.info("Refunding credits due to failure");
      const refunded = await refundCredits(telegramUserId, 1);
      if (refunded) {
        jobLogger.info("Credits refunded successfully");
      } else {
        jobLogger.error("Failed to refund credits");
      }
    }

    // Only send error message to user on LAST retry attempt
    // This prevents multiple error messages during pg-boss retry cycles
    const isLastAttempt = job.retryCount >= (job.retryLimit || 0);

    if (isLastAttempt) {
      try {
        await bot.api.sendMessage(
          chatId,
          "😔 Произошла ошибка при обработке сообщения. Ваш кредит возвращён. Пожалуйста, попробуйте ещё раз.",
          {
            reply_parameters: { message_id: messageId },
          }
        );
        jobLogger.debug("Error message sent to user (last attempt)");
      } catch (sendError) {
        jobLogger.warn({ error: sendError }, "Failed to send error message to user");
      }
    } else {
      jobLogger.debug(
        { retryCount: job.retryCount, retryLimit: job.retryLimit },
        "Skipping error message, will retry"
      );
    }

    // Re-throw error to trigger pg-boss retry for transient errors
    throw error;
  }
}

/**
 * Register chat reply worker with pg-boss
 *
 * Configures worker with appropriate concurrency settings:
 * - batchSize: 1 (process one job at a time)
 * - pollingIntervalSeconds: 2 (check for new jobs every 2 seconds)
 *
 * @returns Worker ID from pg-boss
 */
export async function registerChatWorker(): Promise<string> {
  logger.info("Registering chat reply worker");

  const workerId = await registerWorkerWithMetadata<ChatReplyJobData>(
    QUEUE_CHAT_REPLY,
    processChatReply,
    {
      batchSize: 1, // Process one job at a time
      pollingIntervalSeconds: 2, // Check for new jobs every 2 seconds
    }
  );

  logger.info({ workerId }, "Chat reply worker registered");
  return workerId;
}
