/**
 * Credit management service
 * Handles credit checking, consumption, and refunds
 */
import { getSupabase } from "../../core/database.js";
import { getLogger } from "../../core/logger.js";

const logger = getLogger().child({ module: "credits" });

// =============================================================================
// TYPES
// =============================================================================

/**
 * Result of credit grant operation
 */
export interface GrantCreditsResult {
  success: boolean;
  balance: number;
  alreadyGranted: boolean;
  error?: string;
}

/**
 * Free tier configuration
 */
export const FREE_TIER = {
  ONBOARDING_BONUS: 1,
  MAX_FREE_GRANT: 10,
} as const;

/**
 * Check if user has enough credits
 */
export async function hasCredits(telegramUserId: number, amount = 1): Promise<boolean> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("backend_user_credits")
    .select("credits")
    .eq("telegram_user_id", telegramUserId)
    .single();
  
  if (error || !data) {
    logger.warn({ telegramUserId, error }, "Failed to check credits");
    return false;
  }
  
  return data.credits >= amount;
}

/**
 * Consume credits from user account
 * Uses database function to ensure atomicity
 */
export async function consumeCredits(
  telegramUserId: number, 
  amount = 1
): Promise<boolean> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("consume_credits", {
    p_telegram_user_id: telegramUserId,
    p_amount: amount,
  });
  
  if (error) {
    logger.error({ telegramUserId, amount, error }, "Failed to consume credits");
    return false;
  }
  
  logger.info({ telegramUserId, amount, remaining: data }, "Credits consumed");
  return true;
}

/**
 * Refund credits to user account
 * Uses database function to ensure atomicity (no race conditions)
 */
export async function refundCredits(
  telegramUserId: number,
  amount = 1
): Promise<boolean> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("refund_credits", {
    p_telegram_user_id: telegramUserId,
    p_amount: amount,
  });

  if (error) {
    logger.error({ telegramUserId, amount, error }, "Failed to refund credits");
    return false;
  }

  logger.info({ telegramUserId, amount, newBalance: data }, "Credits refunded");
  return true;
}

/**
 * Get user credit balance
 */
export async function getCreditBalance(telegramUserId: number): Promise<number> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("backend_user_credits")
    .select("credits")
    .eq("telegram_user_id", telegramUserId)
    .single();

  if (error || !data) {
    logger.warn({ telegramUserId, error }, "Failed to get credit balance");
    return 0;
  }

  return data.credits;
}

/**
 * Grant initial credits to new user (e.g., for completing onboarding).
 *
 * **Idempotency**: This function is idempotent - calling multiple times
 * will only grant credits once (tracked via `free_credit_granted` flag).
 *
 * **Validation**:
 * - `telegramUserId` must be a positive integer
 * - `amount` must be a positive integer (1-10)
 *
 * **Audit**: All grants are logged to `backend_credit_transactions` table.
 *
 * @param telegramUserId - Telegram user ID (must be positive integer)
 * @param amount - Number of credits to grant (default: 1, max: 10)
 * @returns Grant result with balance and status
 */
export async function grantInitialCredits(
  telegramUserId: number,
  amount = FREE_TIER.ONBOARDING_BONUS
): Promise<GrantCreditsResult> {
  // Input validation at service layer (defense in depth)
  if (!Number.isInteger(telegramUserId) || telegramUserId <= 0) {
    logger.error({ telegramUserId }, "Invalid telegram user ID");
    return {
      success: false,
      balance: 0,
      alreadyGranted: false,
      error: "Invalid user ID",
    };
  }

  if (!Number.isInteger(amount) || amount <= 0) {
    logger.error({ amount }, "Invalid credit amount (must be positive integer)");
    return {
      success: false,
      balance: 0,
      alreadyGranted: false,
      error: "Invalid credit amount",
    };
  }

  if (amount > FREE_TIER.MAX_FREE_GRANT) {
    logger.warn({ amount, max: FREE_TIER.MAX_FREE_GRANT }, "Credit amount exceeds free tier limit");
    return {
      success: false,
      balance: 0,
      alreadyGranted: false,
      error: `Amount exceeds max free tier (${FREE_TIER.MAX_FREE_GRANT})`,
    };
  }

  const supabase = getSupabase();

  // Check current balance before grant (for idempotency detection)
  const { data: currentData } = await supabase
    .from("backend_user_credits")
    .select("credits, free_credit_granted")
    .eq("telegram_user_id", telegramUserId)
    .single();

  const wasAlreadyGranted = currentData?.free_credit_granted === true;
  const balanceBefore = currentData?.credits ?? 0;

  // Call RPC function (handles idempotency at DB level)
  const { data, error } = await supabase.rpc("grant_initial_credits", {
    p_telegram_user_id: telegramUserId,
    p_amount: amount,
  });

  if (error) {
    logger.error(
      { telegramUserId, amount, error, operation: "grant_initial" },
      "Failed to grant initial credits"
    );

    // Distinguish error types
    if (error.message?.includes("Invalid")) {
      return {
        success: false,
        balance: balanceBefore,
        alreadyGranted: wasAlreadyGranted,
        error: error.message,
      };
    }

    return {
      success: false,
      balance: balanceBefore,
      alreadyGranted: wasAlreadyGranted,
      error: error.message || "Database error",
    };
  }

  const newBalance = data as number;
  const actuallyGranted = newBalance > balanceBefore;

  logger.info(
    {
      telegramUserId,
      amount,
      balanceBefore,
      balanceAfter: newBalance,
      alreadyGranted: !actuallyGranted,
      operation: "grant_initial",
    },
    actuallyGranted ? "Initial credits granted" : "Credits already granted (idempotent)"
  );

  return {
    success: true,
    balance: newBalance,
    alreadyGranted: !actuallyGranted,
  };
}

/**
 * @deprecated Use grantInitialCredits instead
 * Grant bonus credit to user (e.g., for completing onboarding)
 * This legacy function only sets a flag - use grantInitialCredits for actual credits
 */
export async function grantBonusCredit(telegramUserId: number): Promise<boolean> {
  const supabase = getSupabase();

  // Legacy: mark bonus_credit_granted in profiles
  // Use grantInitialCredits() for actual credit granting
  const { error } = await supabase
    .from("profiles")
    .update({ bonus_credit_granted: true })
    .eq("telegram_user_id", telegramUserId);

  if (error) {
    logger.error({ telegramUserId, error }, "Failed to grant bonus credit");
    return false;
  }

  logger.info({ telegramUserId }, "Bonus credit granted (legacy flag)");
  return true;
}
