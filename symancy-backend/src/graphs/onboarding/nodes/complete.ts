/**
 * Complete node - T051
 * Grants bonus credit and marks onboarding as complete
 */
import type { OnboardingState } from "../state.js";
import { getBotApi } from "../../../core/telegram.js";
import { getSupabase } from "../../../core/database.js";
import { grantInitialCredits } from "../../../modules/credits/service.js";
import { getLogger } from "../../../core/logger.js";
import { findOrCreateByTelegramId } from "../../../services/user/UnifiedUserService.js";

const logger = getLogger().child({ module: "onboarding:complete" });

/**
 * Complete onboarding:
 * 1. Grant bonus credit
 * 2. Mark onboarding_completed = true in profiles
 * 3. Send completion message
 */
export async function complete(
  state: OnboardingState
): Promise<Partial<OnboardingState>> {
  const { chatId, telegramUserId, name, goals } = state;
  const bot = getBotApi();
  const supabase = getSupabase();

  // Guard: Don't complete if onboarding data is not collected yet
  // This prevents premature completion during initial graph traversal
  if (!name && (!goals || goals.length === 0)) {
    logger.debug({ telegramUserId }, "Complete called prematurely, skipping");
    return { step: "complete" };
  }

  try {
    // Grant initial credits (actual credits, not just a flag)
    const grantResult = await grantInitialCredits(telegramUserId);

    if (!grantResult.success) {
      logger.warn({ telegramUserId, error: grantResult.error }, "Failed to grant initial credits, but continuing");
    } else if (grantResult.alreadyGranted) {
      logger.info({ telegramUserId, balance: grantResult.balance }, "Credits already granted (idempotent)");
    } else {
      logger.info({ telegramUserId, balance: grantResult.balance }, "Initial credits granted successfully");
    }

    // Create unified_users record — trigger auto-copies credits from backend_user_credits
    try {
      await findOrCreateByTelegramId({
        telegramId: telegramUserId,
        displayName: name || "User",
        languageCode: "ru",
      });
      logger.info({ telegramUserId }, "Unified user record created/updated");
    } catch (unifiedError) {
      logger.warn({ telegramUserId, error: unifiedError }, "Failed to create unified user record, credits may not sync to Mini App");
    }

    // Mark free credit as granted in unified_user_credits
    try {
      const supabaseForUpdate = getSupabase();
      const { data: unifiedUser } = await supabaseForUpdate
        .from("unified_users")
        .select("id")
        .eq("telegram_id", telegramUserId)
        .single();

      if (unifiedUser) {
        await supabaseForUpdate
          .from("unified_user_credits")
          .update({ free_credit_granted: true })
          .eq("unified_user_id", unifiedUser.id);
      }
    } catch (flagError) {
      logger.warn({ telegramUserId, error: flagError }, "Failed to set free_credit_granted flag");
    }

    // Mark onboarding as complete
    const { error: dbError } = await supabase
      .from("profiles")
      .update({ onboarding_completed: true })
      .eq("telegram_user_id", telegramUserId);

    if (dbError) {
      logger.error(
        { telegramUserId, error: dbError },
        "Failed to mark onboarding complete"
      );
      throw dbError;
    }

    logger.info({ telegramUserId }, "Onboarding marked as complete");

    // Send completion message
    const userName = name || "друг";
    const completionMessage = `🎉 Отлично, ${userName}! Мы познакомились.

💝 В подарок вам <b>1 бесплатный кредит</b> для гадания на кофейной гуще!

Просто отправьте мне фото своей кофейной чашки, и я раскрою её тайны ☕️✨`;

    await bot.sendMessage(chatId, completionMessage, {
      parse_mode: "HTML",
    });

    logger.info({ telegramUserId, chatId }, "Completion message sent");

    return {
      completed: true,
      bonusCreditGranted: grantResult.success,
    };
  } catch (error) {
    logger.error({ telegramUserId, error }, "Failed in complete node");
    throw error;
  }
}
