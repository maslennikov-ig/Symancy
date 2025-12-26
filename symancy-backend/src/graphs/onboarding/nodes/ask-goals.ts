/**
 * Ask Goals node - T050
 * Saves user's goals and routes to timezone or complete
 */
import type { OnboardingState, UserGoalType } from "../state.js";
import { getSupabase } from "../../../core/database.js";
import { getLogger } from "../../../core/logger.js";

const logger = getLogger().child({ module: "onboarding:ask-goals" });

/**
 * Save user's goals and determine next step
 * Conditional routing:
 * - If goals contain "spiritual" → ask_timezone (for meditation reminders)
 * - Otherwise → complete
 */
export async function askGoals(
  state: OnboardingState
): Promise<Partial<OnboardingState>> {
  const { telegramUserId, goals } = state;

  if (!goals || goals.length === 0) {
    logger.warn({ telegramUserId }, "askGoals called without goals in state");
    throw new Error("Goals are required in state");
  }

  const supabase = getSupabase();

  try {
    // Save goals to profiles table
    const { error: dbError } = await supabase
      .from("profiles")
      .update({ goals })
      .eq("telegram_user_id", telegramUserId);

    if (dbError) {
      logger.error({ telegramUserId, error: dbError }, "Failed to save goals to database");
      throw dbError;
    }

    logger.info({ telegramUserId, goals }, "Goals saved to profile");

    // Determine next step based on goals
    const hasSpiritual = goals.includes("spiritual" as UserGoalType);
    const nextStep = hasSpiritual ? "ask_timezone" : "complete";

    logger.info(
      { telegramUserId, hasSpiritual, nextStep },
      "Goals processed, routing to next step"
    );

    return {
      step: nextStep,
      goals,
    };
  } catch (error) {
    logger.error({ telegramUserId, error }, "Failed in askGoals node");
    throw error;
  }
}
