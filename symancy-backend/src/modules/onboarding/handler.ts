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
        { telegramUserId, timezone, completed: result.completed },
        "Timezone selected, onboarding flow updated"
      );
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
