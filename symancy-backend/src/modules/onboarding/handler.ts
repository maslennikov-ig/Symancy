/**
 * Onboarding handler - T054
 * Manages onboarding flow by invoking LangGraph and handling callbacks
 */
import type { BotContext } from "../router/middleware.js";
import { onboardingGraph } from "../../graphs/onboarding/index.js";
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

const logger = getLogger().child({ module: "onboarding:handler" });

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
 * @param ctx - Bot context
 * @param photoFileId - Telegram file ID of the photo to process after onboarding
 */
export async function startOnboardingWithPendingPhoto(
  ctx: BotContext,
  photoFileId: string
): Promise<void> {
  const telegramUserId = ctx.from?.id;
  const chatId = ctx.chat?.id;

  if (!telegramUserId || !chatId) {
    logger.warn("Missing telegramUserId or chatId in context");
    return;
  }

  const supabase = getSupabase();

  try {
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

    // Update user_states to onboarding mode with pending photo
    await supabase.from("user_states").upsert({
      telegram_user_id: telegramUserId,
      onboarding_step: "welcome",
      onboarding_data: JSON.stringify({
        goals: [],
        pending_photo_file_id: photoFileId,
      }),
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
    await ctx.reply(
      "Произошла ошибка при начале знакомства. Попробуйте снова позже."
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

    const onboardingData = userState.onboarding_data || { goals: [] };
    let selectedGoals: UserGoalType[] = Array.isArray(onboardingData.goals)
      ? (onboardingData.goals as UserGoalType[])
      : [];

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

      // Save updated goals to state
      await supabase
        .from("user_states")
        .update({
          onboarding_data: JSON.stringify({ goals: selectedGoals }),
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

      // Update user state
      await supabase
        .from("user_states")
        .update({
          onboarding_step: result.step,
          onboarding_data: JSON.stringify({}), // Clear temporary data
        })
        .eq("telegram_user_id", telegramUserId);

      logger.info(
        { telegramUserId, selectedGoals, nextStep: result.step },
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
      const pendingPhotoFileId = onboardingData.pending_photo_file_id as
        | string
        | undefined;

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

      // If onboarding completed and there's a pending photo, process it
      if (result.completed && pendingPhotoFileId) {
        logger.info(
          { telegramUserId, pendingPhotoFileId },
          "Processing pending photo after onboarding completion"
        );

        // Send message that we're now processing the photo
        await ctx.api.sendMessage(
          chatId,
          "✨ Отлично, теперь я знаю вас немного лучше!\n\n" +
            "А теперь давайте посмотрим на вашу фотографию... ☕",
          { parse_mode: "HTML" }
        );

        // Queue the pending photo for processing
        await processPendingPhoto(telegramUserId, chatId, pendingPhotoFileId);
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
 * @param telegramUserId - Telegram user ID
 * @param chatId - Chat ID to send messages to
 * @param fileId - Telegram file ID of the pending photo
 */
async function processPendingPhoto(
  telegramUserId: number,
  chatId: number,
  fileId: string
): Promise<void> {
  try {
    const api = getBotApi();

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

    // Prepare job data
    const jobData: PhotoAnalysisJobData = {
      telegramUserId,
      chatId,
      messageId: loadingMessage.message_id,
      fileId,
      persona: "arina", // Default to Arina for new users
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
    logger.error(
      { error, telegramUserId, fileId },
      "Failed to process pending photo"
    );
  }
}
