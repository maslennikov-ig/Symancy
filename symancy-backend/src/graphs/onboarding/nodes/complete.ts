/**
 * Complete node - T051
 * Grants bonus credit and marks onboarding as complete
 */
import type { OnboardingState } from "../state.js";
import { getBotApi } from "../../../core/telegram.js";
import { getSupabase } from "../../../core/database.js";
import {
  grantUnifiedInitialCredits,
  WELCOME_GIFT,
} from "../../../modules/credits/service.js";
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
    // 1) Ensure unified_users row exists BEFORE granting credits.
    //    The new type-aware grant flow operates on unified_user_credits and needs
    //    a valid unified_user_id.
    let unifiedUserId: string | null = null;
    try {
      const unifiedUser = await findOrCreateByTelegramId({
        telegramId: telegramUserId,
        displayName: name || "User",
        languageCode: "ru",
      });
      unifiedUserId = unifiedUser?.id ?? null;
      logger.info({ telegramUserId, unifiedUserId }, "Unified user record ready");
    } catch (unifiedError) {
      logger.warn(
        { telegramUserId, error: unifiedError },
        "Failed to create unified user record; welcome credits will be skipped"
      );
    }

    // 2) Grant welcome credits (Summer 2026: 3 basic + 1 pro) atomically and
    //    idempotently. Falls back gracefully if unified_users could not be created.
    let grantResult: Awaited<ReturnType<typeof grantUnifiedInitialCredits>> | null = null;
    if (unifiedUserId) {
      grantResult = await grantUnifiedInitialCredits(unifiedUserId, WELCOME_GIFT);
      if (!grantResult.success) {
        logger.warn(
          { telegramUserId, unifiedUserId, error: grantResult.error },
          "Failed to grant welcome credits, but continuing"
        );
      } else if (grantResult.alreadyGranted) {
        logger.info(
          { telegramUserId, unifiedUserId, balance: grantResult.balance },
          "Welcome credits already granted (idempotent)"
        );
      } else {
        logger.info(
          { telegramUserId, unifiedUserId, granted: grantResult.granted, balance: grantResult.balance },
          "Welcome credits granted successfully"
        );
      }
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

    // Send completion message. Use the actually-granted amounts so the user
    // sees what landed on their balance even if a partial failure occurred.
    const userName = name || "друг";
    const grantedBasic = grantResult?.granted.basic ?? 0;
    const grantedPro = grantResult?.granted.pro ?? 0;
    const totalGranted = grantedBasic + grantedPro + (grantResult?.granted.cassandra ?? 0);

    let giftLine: string;
    if (totalGranted > 0) {
      const parts: string[] = [];
      if (grantedBasic > 0) parts.push(`<b>${grantedBasic} базовых</b>`);
      if (grantedPro > 0) parts.push(`<b>${grantedPro} PRO</b>`);
      if ((grantResult?.granted.cassandra ?? 0) > 0) {
        parts.push(`<b>${grantResult!.granted.cassandra} Кассандра</b>`);
      }
      giftLine = `💝 В подарок вам ${parts.join(" + ")} ${totalGranted === 1 ? "кредит" : "кредитов"} для гадания на кофейной гуще!`;
    } else {
      // Either already granted before or grant failed — show neutral wording
      giftLine = `☕️ Готовы к первому гаданию? Просто пришлите фото кофейной чашки.`;
    }

    const completionMessage = `🎉 Отлично, ${userName}! Мы познакомились.

${giftLine}

Просто отправьте мне фото своей кофейной чашки, и я раскрою её тайны ☕️✨`;

    await bot.sendMessage(chatId, completionMessage, {
      parse_mode: "HTML",
    });

    logger.info({ telegramUserId, chatId }, "Completion message sent");

    return {
      completed: true,
      bonusCreditGranted: grantResult?.success === true && !grantResult.alreadyGranted,
    };
  } catch (error) {
    logger.error({ telegramUserId, error }, "Failed in complete node");
    throw error;
  }
}
