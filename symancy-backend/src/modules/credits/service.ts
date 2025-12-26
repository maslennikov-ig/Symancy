/**
 * Credit management service
 * Handles credit checking, consumption, and refunds
 */
import { getSupabase } from "../../core/database.js";
import { getLogger } from "../../core/logger.js";

const logger = getLogger().child({ module: "credits" });

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
 * Grant bonus credit to user (e.g., for completing onboarding)
 * TODO: This currently updates a flag in profiles.
 * When backend_user_credits table is created, update to grant actual credits.
 */
export async function grantBonusCredit(telegramUserId: number): Promise<boolean> {
  const supabase = getSupabase();

  // For now, mark bonus_credit_granted in profiles
  // Later: use backend_user_credits table
  const { error } = await supabase
    .from("profiles")
    .update({ bonus_credit_granted: true })
    .eq("telegram_user_id", telegramUserId);

  if (error) {
    logger.error({ telegramUserId, error }, "Failed to grant bonus credit");
    return false;
  }

  logger.info({ telegramUserId }, "Bonus credit granted");
  return true;
}
