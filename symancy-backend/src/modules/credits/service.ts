/**
 * Credit management service
 * Handles credit checking, consumption, and refunds
 *
 * Supports:
 * - Unified credits (unified_user_credits table via telegram_id)
 * - Three credit types: basic, pro, cassandra
 * - Legacy fallback for unlinked users (backend_user_credits)
 */
import { getSupabase } from "../../core/database.js";
import { getLogger } from "../../core/logger.js";
import type { CreditType } from "../../types/job-schemas.js";

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
 * Linked account info
 */
interface LinkedAccount {
  authId: string;
  isLinked: true;
}

interface UnlinkedAccount {
  authId: null;
  isLinked: false;
}

type AccountLinkStatus = LinkedAccount | UnlinkedAccount;

/**
 * Free tier configuration
 */
export const FREE_TIER = {
  ONBOARDING_BONUS: 1,
  MAX_FREE_GRANT: 10,
} as const;

// =============================================================================
// LINK STATUS CACHE
// =============================================================================

/**
 * In-memory cache for account link status
 * Reduces redundant unified_users queries (TTL: 5 minutes)
 */
interface CacheEntry {
  status: AccountLinkStatus;
  expiresAt: number;
}

const LINK_STATUS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const linkStatusCache = new Map<number, CacheEntry>();

/**
 * Clear the link status cache (for testing or after account linking)
 */
export function clearLinkStatusCache(telegramUserId?: number): void {
  if (telegramUserId !== undefined) {
    linkStatusCache.delete(telegramUserId);
    logger.debug({ telegramUserId }, "Link status cache cleared for user");
  } else {
    linkStatusCache.clear();
    logger.debug("Link status cache cleared entirely");
  }
}

/**
 * Invalidate cache for a specific user (call after account linking)
 */
export function invalidateLinkStatusCache(telegramUserId: number): void {
  linkStatusCache.delete(telegramUserId);
}

// =============================================================================
// ACCOUNT LINKING HELPERS
// =============================================================================

/**
 * Check if Telegram user has a linked web account (auth_id)
 * Returns auth_id if linked, null otherwise
 *
 * Uses in-memory cache with 5-minute TTL to reduce database queries.
 *
 * @param telegramUserId - Telegram user ID
 * @returns Account link status with auth_id if linked
 */
async function getAccountLinkStatus(telegramUserId: number): Promise<AccountLinkStatus> {
  // Check cache first
  const cached = linkStatusCache.get(telegramUserId);
  if (cached && cached.expiresAt > Date.now()) {
    logger.debug({ telegramUserId, isLinked: cached.status.isLinked }, "Link status cache hit");
    return cached.status;
  }

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("unified_users")
    .select("auth_id")
    .eq("telegram_id", telegramUserId)
    .single();

  let status: AccountLinkStatus;

  // Distinguish error types
  if (error) {
    if (error.code === "PGRST116") {
      // Not found - user doesn't exist in unified_users yet (treat as unlinked)
      status = { authId: null, isLinked: false };
    } else {
      // Actual database error - log and treat as unlinked to not break operations
      logger.error({ telegramUserId, error }, "Database error checking link status");
      status = { authId: null, isLinked: false };
    }
  } else if (!data?.auth_id) {
    status = { authId: null, isLinked: false };
  } else {
    status = { authId: data.auth_id, isLinked: true };
  }

  // Cache the result
  linkStatusCache.set(telegramUserId, {
    status,
    expiresAt: Date.now() + LINK_STATUS_CACHE_TTL_MS,
  });
  logger.debug({ telegramUserId, isLinked: status.isLinked }, "Link status cache miss - cached");

  return status;
}

// =============================================================================
// CREDIT OPERATIONS
// =============================================================================

/**
 * Check if user has enough credits
 * For linked accounts, checks user_credits.basic_credits
 * For unlinked accounts, checks backend_user_credits.credits
 */
export async function hasCredits(telegramUserId: number, amount = 1): Promise<boolean> {
  // Validate inputs
  if (!Number.isInteger(telegramUserId) || telegramUserId <= 0) {
    logger.error({ telegramUserId }, "Invalid telegram user ID");
    return false;
  }

  if (!Number.isInteger(amount) || amount <= 0) {
    logger.error({ amount }, "Invalid credit amount");
    return false;
  }

  const supabase = getSupabase();
  const linkStatus = await getAccountLinkStatus(telegramUserId);

  if (linkStatus.isLinked) {
    const { data, error } = await supabase
      .from("user_credits")
      .select("basic_credits")
      .eq("user_id", linkStatus.authId)
      .single();

    if (error || !data) {
      logger.warn({ telegramUserId, authId: linkStatus.authId, error }, "Failed to check linked credits");
      return false;
    }

    return data.basic_credits >= amount;
  }

  // Unlinked account - check backend_user_credits
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
 * For linked accounts, uses user_credits.basic_credits via atomic RPC
 * For unlinked accounts, uses backend_user_credits via RPC
 */
export async function consumeCredits(
  telegramUserId: number,
  amount = 1
): Promise<boolean> {
  // Validate inputs
  if (!Number.isInteger(telegramUserId) || telegramUserId <= 0) {
    logger.error({ telegramUserId }, "Invalid telegram user ID");
    return false;
  }

  if (!Number.isInteger(amount) || amount <= 0) {
    logger.error({ amount }, "Invalid credit amount");
    return false;
  }

  const supabase = getSupabase();
  const linkStatus = await getAccountLinkStatus(telegramUserId);

  if (linkStatus.isLinked) {
    // Linked account - use atomic RPC function
    const { data, error } = await supabase.rpc("consume_linked_credits", {
      p_user_id: linkStatus.authId,
      p_amount: amount
    });

    if (error) {
      logger.error({ telegramUserId, authId: linkStatus.authId, amount, error }, "Failed to consume linked credits");
      return false;
    }

    // RPC returns -1 if insufficient credits
    if (data === null || data < 0) {
      logger.warn({ telegramUserId, authId: linkStatus.authId, amount }, "Insufficient linked credits");
      return false;
    }

    logger.info({ telegramUserId, authId: linkStatus.authId, amount, remaining: data }, "Linked credits consumed");
    return true;
  }

  // Unlinked account - use existing RPC
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
 * For linked accounts, uses user_credits.basic_credits via atomic RPC
 * For unlinked accounts, uses backend_user_credits via RPC
 */
export async function refundCredits(
  telegramUserId: number,
  amount = 1
): Promise<boolean> {
  // Validate inputs
  if (!Number.isInteger(telegramUserId) || telegramUserId <= 0) {
    logger.error({ telegramUserId }, "Invalid telegram user ID");
    return false;
  }

  if (!Number.isInteger(amount) || amount <= 0) {
    logger.error({ amount }, "Invalid credit amount");
    return false;
  }

  const supabase = getSupabase();
  const linkStatus = await getAccountLinkStatus(telegramUserId);

  if (linkStatus.isLinked) {
    // Linked account - use atomic RPC function
    const { data, error } = await supabase.rpc("refund_linked_credits", {
      p_user_id: linkStatus.authId,
      p_amount: amount
    });

    if (error) {
      logger.error({ telegramUserId, authId: linkStatus.authId, amount, error }, "Failed to refund linked credits");
      return false;
    }

    logger.info({ telegramUserId, authId: linkStatus.authId, amount, newBalance: data }, "Linked credits refunded");
    return true;
  }

  // Unlinked account - use existing RPC
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
 * For linked accounts, returns user_credits.basic_credits
 * For unlinked accounts, returns backend_user_credits.credits
 */
export async function getCreditBalance(telegramUserId: number): Promise<number> {
  // Validate inputs
  if (!Number.isInteger(telegramUserId) || telegramUserId <= 0) {
    logger.error({ telegramUserId }, "Invalid telegram user ID");
    return 0;
  }

  const supabase = getSupabase();
  const linkStatus = await getAccountLinkStatus(telegramUserId);

  if (linkStatus.isLinked) {
    const { data, error } = await supabase
      .from("user_credits")
      .select("basic_credits")
      .eq("user_id", linkStatus.authId)
      .single();

    if (error || !data) {
      logger.warn({ telegramUserId, authId: linkStatus.authId, error }, "Failed to get linked credit balance");
      return 0;
    }

    return data.basic_credits;
  }

  // Unlinked account - get from backend_user_credits
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

// =============================================================================
// UNIFIED CREDIT OPERATIONS (with credit type support)
// =============================================================================

/**
 * Extended credit type including cassandra
 */
export type ExtendedCreditType = CreditType | "cassandra";

/**
 * Check if user has credits of a specific type
 * Uses unified_user_credits via telegram_id
 *
 * @param telegramUserId - Telegram user ID
 * @param creditType - Type of credit to check (basic, pro, cassandra)
 * @returns true if user has at least 1 credit of specified type
 */
export async function hasCreditsOfType(
  telegramUserId: number,
  creditType: ExtendedCreditType
): Promise<boolean> {
  if (!Number.isInteger(telegramUserId) || telegramUserId <= 0) {
    logger.error({ telegramUserId }, "Invalid telegram user ID");
    return false;
  }

  const supabase = getSupabase();

  const { data, error } = await supabase.rpc("has_unified_credit", {
    p_telegram_id: telegramUserId,
    p_credit_type: creditType,
  });

  if (error) {
    logger.error({ telegramUserId, creditType, error }, "Failed to check unified credits");
    return false;
  }

  logger.debug({ telegramUserId, creditType, hasCredits: data }, "Checked unified credits");
  return data === true;
}

/**
 * Consume one credit of a specific type
 * Uses unified_user_credits via telegram_id with atomic row locking
 *
 * @param telegramUserId - Telegram user ID
 * @param creditType - Type of credit to consume (basic, pro, cassandra)
 * @returns true if credit was consumed, false if insufficient
 */
export async function consumeCreditsOfType(
  telegramUserId: number,
  creditType: ExtendedCreditType
): Promise<boolean> {
  if (!Number.isInteger(telegramUserId) || telegramUserId <= 0) {
    logger.error({ telegramUserId }, "Invalid telegram user ID");
    return false;
  }

  const supabase = getSupabase();

  const { data, error } = await supabase.rpc("consume_unified_credit", {
    p_telegram_id: telegramUserId,
    p_credit_type: creditType,
  });

  if (error) {
    logger.error({ telegramUserId, creditType, error }, "Failed to consume unified credits");
    return false;
  }

  // RPC returns array with { success, remaining }
  const result = data?.[0];
  if (!result?.success) {
    logger.warn({ telegramUserId, creditType }, "Insufficient unified credits");
    return false;
  }

  logger.info(
    { telegramUserId, creditType, remaining: result.remaining },
    "Unified credit consumed"
  );
  return true;
}

/**
 * Refund one credit of a specific type
 * Uses unified_user_credits via telegram_id
 *
 * @param telegramUserId - Telegram user ID
 * @param creditType - Type of credit to refund (basic, pro, cassandra)
 * @returns true if credit was refunded
 */
export async function refundCreditsOfType(
  telegramUserId: number,
  creditType: ExtendedCreditType
): Promise<boolean> {
  if (!Number.isInteger(telegramUserId) || telegramUserId <= 0) {
    logger.error({ telegramUserId }, "Invalid telegram user ID");
    return false;
  }

  const supabase = getSupabase();

  const { data, error } = await supabase.rpc("refund_unified_credit", {
    p_telegram_id: telegramUserId,
    p_credit_type: creditType,
  });

  if (error) {
    logger.error({ telegramUserId, creditType, error }, "Failed to refund unified credits");
    return false;
  }

  // RPC returns array with { success, new_balance }
  const result = data?.[0];
  if (!result?.success) {
    logger.error({ telegramUserId, creditType }, "Failed to refund unified credit");
    return false;
  }

  logger.info(
    { telegramUserId, creditType, newBalance: result.new_balance },
    "Unified credit refunded"
  );
  return true;
}

/**
 * Get all credit balances for a user
 * Returns { basic, pro, cassandra } counts
 *
 * @param telegramUserId - Telegram user ID
 * @returns Object with credit counts, or null if user not found
 */
export async function getAllCredits(
  telegramUserId: number
): Promise<{ basic: number; pro: number; cassandra: number } | null> {
  if (!Number.isInteger(telegramUserId) || telegramUserId <= 0) {
    logger.error({ telegramUserId }, "Invalid telegram user ID");
    return null;
  }

  const supabase = getSupabase();

  const { data, error } = await supabase.rpc("get_unified_credits", {
    p_telegram_id: telegramUserId,
  });

  if (error) {
    logger.error({ telegramUserId, error }, "Failed to get unified credits");
    return null;
  }

  // RPC returns array with single row
  const result = data?.[0];
  if (!result) {
    logger.warn({ telegramUserId }, "User not found in unified_user_credits");
    return null;
  }

  return {
    basic: result.basic ?? 0,
    pro: result.pro ?? 0,
    cassandra: result.cassandra ?? 0,
  };
}

