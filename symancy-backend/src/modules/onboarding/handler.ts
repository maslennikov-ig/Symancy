/**
 * Onboarding handler - T054
 * Manages onboarding flow by invoking LangGraph and handling callbacks
 */
import type { BotContext } from "../router/middleware.js";
import { onboardingGraph } from "../../graphs/onboarding/index.js";
import { UserGoal } from "../../graphs/onboarding/state.js";
import type { OnboardingState, UserGoalType } from "../../graphs/onboarding/state.js";
import {
  createGoalsKeyboard,
  parseOnboardingCallback,
} from "./keyboards.js";
import { getSupabase } from "../../core/database.js";
import { getLogger } from "../../core/logger.js";
import { sendJob } from "../../core/queue.js";
import { getBotApi } from "../../core/telegram.js";
import type { PhotoAnalysisJobData } from "../../types/telegram.js";
import { QUEUE_ANALYZE_PHOTO } from "../../config/constants.js";
import { grantInitialCredits } from "../credits/service.js";
import { z } from "zod";

const logger = getLogger().child({ module: "onboarding:handler" });

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Telegram file_id expiration time in milliseconds
 * File IDs are valid for approximately 1 hour, we use 55 minutes for safety margin
 */
const FILE_ID_EXPIRATION_MS = 55 * 60 * 1000; // 55 minutes

// =============================================================================
// ZOD SCHEMAS - HIGH #4 FIX
// =============================================================================

/**
 * Valid persona types for photo analysis
 */
const PersonaSchema = z.enum(["arina", "cassandra"]);

/**
 * Zod schema for onboarding_data stored in user_states
 * Uses the same UserGoal schema as the graph state for consistency
 */
const OnboardingDataSchema = z.object({
  goals: z.array(UserGoal).default([]),
  pending_photo_file_id: z.string().optional(),
  pending_photo_timestamp: z.number().optional(),
  pending_photo_persona: PersonaSchema.optional(), // MEDIUM #9: Save persona from caption
});

/**
 * Type for onboarding data stored in user_states.onboarding_data
 */
type OnboardingData = z.infer<typeof OnboardingDataSchema>;

/**
 * Safely parse onboarding_data with fallback to empty state
 * @param data - Raw data from database (unknown type)
 * @returns Validated OnboardingData
 */
function parseOnboardingData(data: unknown): OnboardingData {
  try {
    // Handle null/undefined
    if (!data) {
      return { goals: [] };
    }

    // Parse and validate
    const result = OnboardingDataSchema.safeParse(data);

    if (result.success) {
      return result.data;
    }

    // Log validation errors but don't crash
    logger.warn(
      { error: result.error.format(), rawData: data },
      "Invalid onboarding_data format, using defaults"
    );

    return { goals: [] };
  } catch (error) {
    logger.error({ error, rawData: data }, "Failed to parse onboarding_data");
    return { goals: [] };
  }
}

/**
 * Check if user is currently in onboarding flow
 * @param ctx - Bot context with user state
 * @returns True if user is in onboarding mode
 */
export async function isInOnboarding(ctx: BotContext): Promise<boolean> {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    return false;
  }

  const supabase = getSupabase();

  try {
    const { data: userState } = await supabase
      .from("user_states")
      .select("onboarding_step")
      .eq("telegram_user_id", telegramUserId)
      .single();

    return !!userState?.onboarding_step;
  } catch (error) {
    logger.error({ error, telegramUserId }, "Failed to check onboarding status");
    return false;
  }
}

/**
 * Start onboarding flow with a pending photo
 * Used when a new user sends a photo before completing onboarding
 * Saves the photo and sends a friendly Arina message before starting onboarding
 *
 * FIXES:
 * - CRITICAL #1: Race condition prevention - checks if onboarding already started
 * - CRITICAL #3: Adds timestamp for file_id expiration tracking
 * - MEDIUM #9: Saves persona preference from photo caption
 *
 * @param ctx - Bot context
 * @param photoFileId - Telegram file ID of the photo to process after onboarding
 * @param persona - Optional persona preference from photo caption
 */
export async function startOnboardingWithPendingPhoto(
  ctx: BotContext,
  photoFileId: string,
  persona?: "arina" | "cassandra"
): Promise<void> {
  const telegramUserId = ctx.from?.id;
  const chatId = ctx.chat?.id;

  if (!telegramUserId || !chatId) {
    logger.warn("Missing telegramUserId or chatId in context");
    return;
  }

  const supabase = getSupabase();

  try {
    // CRITICAL #1 FIX: Check if onboarding is already in progress
    // This prevents race condition when user sends multiple photos rapidly
    const { data: existingState } = await supabase
      .from("user_states")
      .select("onboarding_step, onboarding_data")
      .eq("telegram_user_id", telegramUserId)
      .single();

    if (existingState?.onboarding_step) {
      // Onboarding already started - just update pending photo, don't restart flow
      logger.info(
        { telegramUserId, photoFileId, currentStep: existingState.onboarding_step },
        "User sent another photo during onboarding - updating pending photo"
      );

      // Update to newest photo (user probably wants this one processed)
      const existingData = parseOnboardingData(existingState.onboarding_data);
      const updatedData: OnboardingData = {
        ...existingData,
        pending_photo_file_id: photoFileId,
        pending_photo_timestamp: Date.now(),
        pending_photo_persona: persona || existingData.pending_photo_persona, // Keep previous if no new persona
      };

      await supabase
        .from("user_states")
        .update({
          onboarding_data: JSON.stringify(updatedData),
        })
        .eq("telegram_user_id", telegramUserId);

      // Send a short acknowledgment (not the full onboarding message)
      await ctx.reply(
        "☕ Записала! Эту фотографию посмотрю сразу после знакомства.",
        { parse_mode: "HTML" }
      );
      return;
    }

    logger.info(
      { telegramUserId, chatId, photoFileId },
      "Starting onboarding with pending photo"
    );

    // Send friendly Arina message acknowledging the photo
    await ctx.reply(
      "☕ О, вижу интересную чашку! Я с радостью расскажу, что вижу в кофейной гуще...\n\n" +
        "Но сначала давайте познакомимся — это займёт всего минуту, " +
        "а потом я сразу вернусь к вашей фотографии! ✨",
      { parse_mode: "HTML" }
    );

    // CRITICAL #3 FIX: Add timestamp for file_id expiration tracking
    // MEDIUM #9 FIX: Save persona preference from caption
    const onboardingData: OnboardingData = {
      goals: [],
      pending_photo_file_id: photoFileId,
      pending_photo_timestamp: Date.now(),
      pending_photo_persona: persona,
    };

    // Update user_states to onboarding mode with pending photo
    await supabase.from("user_states").upsert({
      telegram_user_id: telegramUserId,
      onboarding_step: "welcome",
      onboarding_data: JSON.stringify(onboardingData),
      updated_at: new Date().toISOString(),
    });

    // Invoke graph with welcome step
    const initialState: OnboardingState = {
      telegramUserId,
      chatId,
      step: "welcome",
      name: null,
      goals: [],
      timezone: "Europe/Moscow",
      notificationsEnabled: true,
      completed: false,
      bonusCreditGranted: false,
    };

    const result = await onboardingGraph.invoke(initialState);

    // Update user state with new step (keep pending photo in onboarding_data)
    await supabase
      .from("user_states")
      .update({
        onboarding_step: result.step,
      })
      .eq("telegram_user_id", telegramUserId);

    logger.info(
      { telegramUserId, step: result.step, photoFileId },
      "Onboarding with pending photo started successfully"
    );
  } catch (error) {
    logger.error({ error, telegramUserId, photoFileId }, "Failed to start onboarding with pending photo");

    // HIGH #5 FIX: Cleanup on onboarding failure
    // Clear any partially saved state to allow fresh restart
    try {
      await supabase
        .from("user_states")
        .update({
          onboarding_step: null,
          onboarding_data: JSON.stringify({}),
        })
        .eq("telegram_user_id", telegramUserId);

      logger.info({ telegramUserId }, "Cleaned up failed onboarding state");
    } catch (cleanupError) {
      logger.error({ error: cleanupError, telegramUserId }, "Failed to cleanup onboarding state");
    }

    await ctx.reply(
      "Произошла ошибка при начале знакомства. Попробуйте отправить фото ещё раз или нажмите /start."
    );
  }
}

/**
 * Start onboarding flow for a new user
 * Sets user state to onboarding mode and invokes welcome node
 * @param ctx - Bot context
 */
export async function startOnboarding(ctx: BotContext): Promise<void> {
  const telegramUserId = ctx.from?.id;
  const chatId = ctx.chat?.id;

  if (!telegramUserId || !chatId) {
    logger.warn("Missing telegramUserId or chatId in context");
    return;
  }

  const supabase = getSupabase();

  try {
    logger.info({ telegramUserId, chatId }, "Starting onboarding flow");

    // Update user_states to onboarding mode
    await supabase
      .from("user_states")
      .upsert({
        telegram_user_id: telegramUserId,
        onboarding_step: "welcome",
        onboarding_data: JSON.stringify({ goals: [] }),
        updated_at: new Date().toISOString(),
      });

    // Invoke graph with welcome step
    const initialState: OnboardingState = {
      telegramUserId,
      chatId,
      step: "welcome",
      name: null,
      goals: [],
      timezone: "Europe/Moscow",
      notificationsEnabled: true,
      completed: false,
      bonusCreditGranted: false,
    };

    const result = await onboardingGraph.invoke(initialState);

    // Update user state with new step
    await supabase
      .from("user_states")
      .update({
        onboarding_step: result.step,
      })
      .eq("telegram_user_id", telegramUserId);

    logger.info(
      { telegramUserId, step: result.step },
      "Onboarding started successfully"
    );
  } catch (error) {
    logger.error({ error, telegramUserId }, "Failed to start onboarding");
    await ctx.reply(
      "Произошла ошибка при начале знакомства. Попробуйте снова позже."
    );
  }
}

/**
 * Handle text messages during onboarding
 * Routes to appropriate graph node based on current step
 * @param ctx - Bot context with text message
 */
export async function handleOnboardingText(ctx: BotContext): Promise<void> {
  const telegramUserId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  const text = ctx.message?.text;

  if (!telegramUserId || !chatId || !text) {
    logger.warn("Missing required fields in context");
    return;
  }

  const supabase = getSupabase();

  try {
    // Get current onboarding state
    const { data: userState } = await supabase
      .from("user_states")
      .select("onboarding_step, onboarding_data")
      .eq("telegram_user_id", telegramUserId)
      .single();

    if (!userState?.onboarding_step) {
      logger.warn({ telegramUserId }, "No onboarding step found");
      return;
    }

    const currentStep = userState.onboarding_step;

    logger.info(
      { telegramUserId, currentStep, text },
      "Processing onboarding text message"
    );

    // Handle based on current step
    if (currentStep === "ask_name") {
      // User sent their name
      const graphState: OnboardingState = {
        telegramUserId,
        chatId,
        step: "ask_name",
        name: text.trim(),
        goals: [],
        timezone: "Europe/Moscow",
        notificationsEnabled: true,
        completed: false,
        bonusCreditGranted: false,
      };

      const result = await onboardingGraph.invoke(graphState);

      // Update user state
      await supabase
        .from("user_states")
        .update({
          onboarding_step: result.step,
        })
        .eq("telegram_user_id", telegramUserId);

      logger.info(
        { telegramUserId, name: text, nextStep: result.step },
        "Name collected and processed"
      );
    } else {
      // For other steps, text input is not expected
      logger.debug({ telegramUserId, currentStep }, "Text message ignored");
    }
  } catch (error) {
    logger.error({ error, telegramUserId }, "Failed to handle onboarding text");
    await ctx.reply("Произошла ошибка. Попробуйте ещё раз.");
  }
}

/**
 * Handle callback queries during onboarding
 * Processes goal selections, confirmations, and timezone choices
 * @param ctx - Bot context with callback query
 */
export async function handleOnboardingCallback(
  ctx: BotContext
): Promise<void> {
  const telegramUserId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  const callbackData = ctx.callbackQuery?.data;

  if (!telegramUserId || !chatId || !callbackData) {
    logger.warn("Missing required fields in callback context");
    return;
  }

  const supabase = getSupabase();

  try {
    // Parse callback data
    const parsed = parseOnboardingCallback(callbackData);

    if (!parsed) {
      logger.warn({ callbackData }, "Invalid onboarding callback data");
      await ctx.answerCallbackQuery({ text: "Неверный формат данных" });
      return;
    }

    logger.info(
      { telegramUserId, type: parsed.type, value: parsed.value },
      "Processing onboarding callback"
    );

    // Get current state
    const { data: userState } = await supabase
      .from("user_states")
      .select("onboarding_step, onboarding_data")
      .eq("telegram_user_id", telegramUserId)
      .single();

    if (!userState) {
      logger.warn({ telegramUserId }, "User state not found");
      await ctx.answerCallbackQuery({ text: "Состояние не найдено" });
      return;
    }

    // HIGH #4 FIX: Use Zod schema for safe parsing
    const onboardingData = parseOnboardingData(userState.onboarding_data);
    let selectedGoals: UserGoalType[] = [...onboardingData.goals];

    // Handle different callback types
    if (parsed.type === "goal") {
      // Toggle goal selection
      const goalKey = parsed.value as UserGoalType;

      if (selectedGoals.includes(goalKey)) {
        // Remove goal
        selectedGoals = selectedGoals.filter((g) => g !== goalKey);
      } else {
        // Add goal
        selectedGoals.push(goalKey);
      }

      // Update keyboard
      const newKeyboard = createGoalsKeyboard(selectedGoals);

      await ctx.editMessageReplyMarkup({ reply_markup: newKeyboard });

      // Save updated goals to state, preserving pending photo data
      const updatedGoalsData: OnboardingData = {
        goals: selectedGoals,
        pending_photo_file_id: onboardingData.pending_photo_file_id,
        pending_photo_timestamp: onboardingData.pending_photo_timestamp,
        pending_photo_persona: onboardingData.pending_photo_persona,
      };

      await supabase
        .from("user_states")
        .update({
          onboarding_data: JSON.stringify(updatedGoalsData),
        })
        .eq("telegram_user_id", telegramUserId);

      await ctx.answerCallbackQuery({ text: "Цель обновлена" });

      logger.info({ telegramUserId, selectedGoals }, "Goals updated");
    } else if (parsed.type === "goals" && parsed.value === "confirm") {
      // User confirmed goal selection
      await ctx.answerCallbackQuery({ text: "Сохранено!" });

      // Invoke graph with selected goals
      const graphState: OnboardingState = {
        telegramUserId,
        chatId,
        step: "ask_goals",
        name: null, // Already saved in DB
        goals: selectedGoals,
        timezone: "Europe/Moscow",
        notificationsEnabled: true,
        completed: false,
        bonusCreditGranted: false,
      };

      const result = await onboardingGraph.invoke(graphState);

      // CRITICAL #2 FIX: Preserve pending_photo_file_id when clearing goals
      // Only clear goals array, keep photo data for timezone step
      const preservedData: OnboardingData = {
        goals: [], // Clear goals (already saved to profile by graph)
        pending_photo_file_id: onboardingData.pending_photo_file_id,
        pending_photo_timestamp: onboardingData.pending_photo_timestamp,
        pending_photo_persona: onboardingData.pending_photo_persona,
      };

      // Update user state
      await supabase
        .from("user_states")
        .update({
          onboarding_step: result.step,
          onboarding_data: JSON.stringify(preservedData),
        })
        .eq("telegram_user_id", telegramUserId);

      logger.info(
        { telegramUserId, selectedGoals, nextStep: result.step, hasPendingPhoto: !!preservedData.pending_photo_file_id },
        "Goals confirmed"
      );
    } else if (parsed.type === "tz") {
      // Timezone selection
      let timezone = "Europe/Moscow";

      if (parsed.value !== "skip") {
        timezone = parsed.value;
      }

      await ctx.answerCallbackQuery({ text: "Часовой пояс сохранён" });

      // Check for pending photo BEFORE clearing onboarding_data
      const pendingPhotoFileId = onboardingData.pending_photo_file_id;
      const pendingPhotoTimestamp = onboardingData.pending_photo_timestamp;
      const pendingPhotoPersona = onboardingData.pending_photo_persona;

      // Invoke graph with timezone
      const graphState: OnboardingState = {
        telegramUserId,
        chatId,
        step: "ask_timezone",
        name: null,
        goals: [],
        timezone,
        notificationsEnabled: true,
        completed: false,
        bonusCreditGranted: false,
      };

      const result = await onboardingGraph.invoke(graphState);

      // Update user state and clear onboarding data
      await supabase
        .from("user_states")
        .update({
          onboarding_step: result.completed ? null : result.step,
          onboarding_data: JSON.stringify({}),
        })
        .eq("telegram_user_id", telegramUserId);

      logger.info(
        { telegramUserId, timezone, completed: result.completed, pendingPhotoFileId },
        "Timezone selected, onboarding flow updated"
      );

      // Grant initial free credit when onboarding completes
      if (result.completed) {
        const grantResult = await grantInitialCredits(telegramUserId);

        if (!grantResult.success) {
          logger.error(
            { telegramUserId, error: grantResult.error },
            "Failed to grant initial credits - user may not be able to analyze photos"
          );
          // Continue with onboarding completion - don't block user
        } else if (grantResult.alreadyGranted) {
          logger.info(
            { telegramUserId, balance: grantResult.balance },
            "Free credit already granted (idempotent call)"
          );
        } else {
          logger.info(
            { telegramUserId, balance: grantResult.balance },
            "Initial free credit granted on onboarding completion"
          );
        }
      }

      // If onboarding completed and there's a pending photo, process it
      if (result.completed && pendingPhotoFileId) {
        // CRITICAL #3 FIX: Check if file_id has expired
        const isExpired = pendingPhotoTimestamp
          ? Date.now() - pendingPhotoTimestamp > FILE_ID_EXPIRATION_MS
          : false;

        if (isExpired) {
          logger.warn(
            { telegramUserId, pendingPhotoFileId, pendingPhotoTimestamp },
            "Pending photo file_id has expired"
          );

          // Notify user that photo expired and ask to resend
          await ctx.api.sendMessage(
            chatId,
            "✨ Отлично, теперь я знаю вас немного лучше!\n\n" +
              "К сожалению, ваша фотография устарела пока мы знакомились. " +
              "Пожалуйста, отправьте её ещё раз, и я сразу начну гадание! ☕",
            { parse_mode: "HTML" }
          );
          return;
        }

        logger.info(
          { telegramUserId, pendingPhotoFileId, pendingPhotoPersona },
          "Processing pending photo after onboarding completion"
        );

        // Send message that we're now processing the photo
        await ctx.api.sendMessage(
          chatId,
          "✨ Отлично, теперь я знаю вас немного лучше!\n\n" +
            "А теперь давайте посмотрим на вашу фотографию... ☕",
          { parse_mode: "HTML" }
        );

        // Queue the pending photo for processing (MEDIUM #9: pass saved persona)
        await processPendingPhoto(telegramUserId, chatId, pendingPhotoFileId, pendingPhotoPersona);
      }
    } else {
      logger.warn({ parsed }, "Unhandled callback type");
      await ctx.answerCallbackQuery({ text: "Неизвестная операция" });
    }
  } catch (error) {
    logger.error(
      { error, telegramUserId, callbackData },
      "Failed to handle onboarding callback"
    );
    await ctx.answerCallbackQuery({ text: "Произошла ошибка" });
  }
}

/**
 * Process a pending photo that was saved before onboarding
 * Called after onboarding completes to analyze the saved photo
 *
 * FIXES:
 * - HIGH #6: Always notifies user on failure
 * - MEDIUM #9: Uses saved persona preference from photo caption
 *
 * @param telegramUserId - Telegram user ID
 * @param chatId - Chat ID to send messages to
 * @param fileId - Telegram file ID of the pending photo
 * @param persona - Optional persona preference (defaults to "arina")
 */
async function processPendingPhoto(
  telegramUserId: number,
  chatId: number,
  fileId: string,
  persona?: "arina" | "cassandra"
): Promise<void> {
  const api = getBotApi();
  let loadingMessageId: number | undefined;

  // Use saved persona or default to Arina
  const selectedPersona = persona || "arina";

  try {
    // Get user profile for name
    const supabase = getSupabase();
    const { data: profile } = await supabase
      .from("profiles")
      .select("name")
      .eq("telegram_user_id", telegramUserId)
      .single();

    // Send loading message
    const loadingMessage = await api.sendMessage(
      chatId,
      "🔮 Настраиваюсь на вашу энергию и всматриваюсь в узоры кофейной гущи..."
    );
    loadingMessageId = loadingMessage.message_id;

    // Prepare job data (MEDIUM #9: use saved persona)
    const jobData: PhotoAnalysisJobData = {
      telegramUserId,
      chatId,
      messageId: loadingMessage.message_id,
      fileId,
      persona: selectedPersona,
      language: "ru",
      userName: profile?.name || undefined,
    };

    // Queue the job
    const jobId = await sendJob(QUEUE_ANALYZE_PHOTO, jobData);

    if (!jobId) {
      logger.error(
        { telegramUserId, fileId },
        "Failed to enqueue pending photo analysis job"
      );
      await api.editMessageText(
        chatId,
        loadingMessage.message_id,
        "❌ Не удалось обработать фотографию. Попробуйте отправить её ещё раз."
      );
      return;
    }

    logger.info(
      { jobId, telegramUserId, fileId },
      "Pending photo analysis job queued successfully"
    );
  } catch (error) {
    // HIGH #6 FIX: Always notify user on failure
    logger.error(
      { error, telegramUserId, fileId },
      "Failed to process pending photo"
    );

    try {
      // Try to update loading message if it exists
      if (loadingMessageId) {
        await api.editMessageText(
          chatId,
          loadingMessageId,
          "❌ Произошла ошибка при обработке фотографии. Пожалуйста, отправьте её ещё раз."
        );
      } else {
        // Otherwise send new message
        await api.sendMessage(
          chatId,
          "❌ Произошла ошибка при обработке фотографии. Пожалуйста, отправьте её ещё раз."
        );
      }
    } catch (notifyError) {
      // Log but don't throw - user notification is best-effort
      logger.error(
        { error: notifyError, telegramUserId },
        "Failed to notify user about photo processing error"
      );
    }
  }
}
