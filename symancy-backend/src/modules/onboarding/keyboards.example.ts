/**
 * Example usage of onboarding keyboards
 * This file demonstrates how to use the keyboard builders in handlers
 */
import type { BotContext } from "../router/middleware.js";
import {
  createGoalsKeyboard,
  createTimezoneKeyboard,
  parseOnboardingCallback,
  ONBOARDING_MESSAGES,
  getGoalLabel,
  GOAL_OPTIONS,
} from "./keyboards.js";

/**
 * Example: Send goals selection keyboard
 * Use in onboarding flow when asking user to select their interests
 */
export async function exampleSendGoalsKeyboard(ctx: BotContext): Promise<void> {
  // Initially no goals selected
  const keyboard = createGoalsKeyboard([]);

  await ctx.reply(ONBOARDING_MESSAGES.selectGoals, {
    reply_markup: keyboard,
  });
}

/**
 * Example: Handle goal toggle callback
 * Updates the selected goals and refreshes the keyboard
 */
export async function exampleHandleGoalToggle(
  ctx: BotContext,
  currentGoals: string[]
): Promise<void> {
  if (!ctx.callbackQuery?.data) {
    return;
  }

  const parsed = parseOnboardingCallback(ctx.callbackQuery.data);

  if (!parsed || parsed.type !== "goal") {
    return;
  }

  const goalKey = parsed.value;

  // Toggle goal selection
  const updatedGoals = currentGoals.includes(goalKey)
    ? currentGoals.filter((g) => g !== goalKey) // Remove if already selected
    : [...currentGoals, goalKey]; // Add if not selected

  // Update keyboard with new selection state
  const keyboard = createGoalsKeyboard(updatedGoals);

  // Answer callback query to remove loading animation
  await ctx.answerCallbackQuery({
    text: `${getGoalLabel(goalKey, updatedGoals.includes(goalKey))}`,
  });

  // Edit message with updated keyboard
  await ctx.editMessageReplyMarkup({
    reply_markup: keyboard,
  });

  // Note: You would save updatedGoals to user state here
  // await saveUserGoals(ctx.from.id, updatedGoals);
}

/**
 * Example: Handle goals confirmation
 * Proceeds to next step after user confirms their selections
 */
export async function exampleHandleGoalsConfirm(
  ctx: BotContext,
  selectedGoals: string[]
): Promise<void> {
  if (!ctx.callbackQuery?.data) {
    return;
  }

  const parsed = parseOnboardingCallback(ctx.callbackQuery.data);

  if (!parsed || parsed.type !== "goals" || parsed.value !== "confirm") {
    return;
  }

  // Format selected goals for display
  const goalLabels = selectedGoals
    .map((key) => {
      const option = GOAL_OPTIONS.find((opt) => opt.key === key);
      return option ? `${option.emoji} ${option.label}` : key;
    })
    .join(", ");

  const message = ONBOARDING_MESSAGES.goalsUpdated.replace(
    "{{goals}}",
    goalLabels
  );

  // Answer callback query
  await ctx.answerCallbackQuery();

  // Edit message to show confirmation
  await ctx.editMessageText(message);

  // Proceed to timezone selection
  const timezoneKeyboard = createTimezoneKeyboard();
  await ctx.reply(ONBOARDING_MESSAGES.selectTimezone, {
    reply_markup: timezoneKeyboard,
  });

  // Note: You would save goals to user state here
  // await saveUserGoals(ctx.from.id, selectedGoals);
}

/**
 * Example: Handle timezone selection
 * Saves timezone and completes onboarding
 */
export async function exampleHandleTimezoneSelect(
  ctx: BotContext
): Promise<void> {
  if (!ctx.callbackQuery?.data) {
    return;
  }

  const parsed = parseOnboardingCallback(ctx.callbackQuery.data);

  if (!parsed || parsed.type !== "tz") {
    return;
  }

  // Note: Extract timezone value for saving to user state
  // const selectedTimezone = parsed.value === "skip" ? "Europe/Moscow" : parsed.value;

  // Find timezone label
  const tzLabel =
    parsed.value === "skip"
      ? "Москва (UTC+3) (по умолчанию)"
      : parsed.value;

  const message = ONBOARDING_MESSAGES.timezoneSet.replace(
    "{{timezone}}",
    tzLabel
  );

  // Answer callback query
  await ctx.answerCallbackQuery();

  // Edit message to show confirmation
  await ctx.editMessageText(message);

  // Note: You would save timezone to user state here
  // await saveUserTimezone(ctx.from.id, selectedTimezone);

  // Proceed to next onboarding step or complete
  await ctx.reply(
    "✨ Отлично! Настройка завершена. Отправьте фото кофейной гущи для первого гадания."
  );
}

/**
 * Example: Complete callback query handler
 * Handles all onboarding callbacks in one place
 */
export async function exampleOnboardingCallbackHandler(
  ctx: BotContext
): Promise<void> {
  if (!ctx.callbackQuery?.data) {
    return;
  }

  const parsed = parseOnboardingCallback(ctx.callbackQuery.data);

  if (!parsed) {
    // Not an onboarding callback
    return;
  }

  // Note: In real implementation, you would fetch current state from database
  const currentGoals: string[] = []; // Fetch from user_states table

  switch (parsed.type) {
    case "goal":
      await exampleHandleGoalToggle(ctx, currentGoals);
      break;

    case "goals":
      if (parsed.value === "confirm") {
        await exampleHandleGoalsConfirm(ctx, currentGoals);
      }
      break;

    case "tz":
      await exampleHandleTimezoneSelect(ctx);
      break;

    default:
      // Unknown callback type
      await ctx.answerCallbackQuery();
  }
}
