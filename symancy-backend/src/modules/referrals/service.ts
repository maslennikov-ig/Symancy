/**
 * Referral program service
 *
 * Thin wrappers around Postgres RPCs that implement the referral program.
 * Pattern mirrors `modules/credits/service.ts`:
 * - resolves the service-role client via `getSupabase()`
 * - calls `.rpc(...)`, checks `error`
 * - logs via a module-scoped child logger
 * - never throws outward; returns safe defaults on failure
 *
 * RPC contract (DB migration already applied):
 * - get_or_create_referral_code(p_unified_user_id uuid) -> text (8-char code)
 * - capture_referral(p_code text, p_referee_telegram_id bigint) -> jsonb
 *     { ok, reason? in invalid_code|self_referral|not_new_user|already_captured }
 * - attribute_referee_signup(p_referee_telegram_id bigint, p_referee_unified_user_id uuid) -> jsonb
 *     { ok, reason?: 'no_pending', credited? }
 * - reward_referrer_on_activation(p_referee_telegram_id bigint) -> jsonb
 *     { ok, reason?: 'nothing_to_reward'|'monthly_limit', credited? }
 * - get_referral_stats(p_unified_user_id uuid) -> jsonb
 *     { code, invited, activated, credits_earned, pending }
 *
 * @module modules/referrals/service
 */
import { getSupabase } from "../../core/database.js";
import { getLogger } from "../../core/logger.js";

const logger = getLogger().child({ module: "referrals" });

// =============================================================================
// TYPES
// =============================================================================

/** Result shape for the mutating referral RPCs. */
export interface ReferralRpcResult {
  ok: boolean;
  reason?: string;
  credited?: number;
}

/** Aggregated referral statistics for a user. */
export interface ReferralStats {
  code: string | null;
  invited: number;
  activated: number;
  credits_earned: number;
  pending: number;
}

/** Generic safe-fail result used when the RPC call itself errors. */
const RPC_ERROR_RESULT: ReferralRpcResult = { ok: false, reason: "rpc_error" };

// =============================================================================
// CODE + STATS (read-ish operations; return null on failure)
// =============================================================================

/**
 * Get (or lazily create) the referral code for a user.
 *
 * @param unifiedUserId - unified_users.id (uuid)
 * @returns The 8-char referral code, or `null` on error/invalid input
 */
export async function getOrCreateCode(unifiedUserId: string): Promise<string | null> {
  if (!unifiedUserId || typeof unifiedUserId !== "string") {
    logger.error({ unifiedUserId }, "Invalid unifiedUserId for getOrCreateCode");
    return null;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("get_or_create_referral_code", {
    p_unified_user_id: unifiedUserId,
  });

  if (error) {
    logger.error({ unifiedUserId, error }, "Failed to get_or_create_referral_code");
    return null;
  }

  // Scalar text RPC: data is the string itself.
  if (typeof data !== "string" || data.length === 0) {
    logger.warn({ unifiedUserId, data }, "Unexpected referral code RPC response");
    return null;
  }

  return data;
}

/**
 * Get aggregated referral stats for a user.
 *
 * @param unifiedUserId - unified_users.id (uuid)
 * @returns Stats object, or `null` on error/invalid input
 */
export async function getStats(unifiedUserId: string): Promise<ReferralStats | null> {
  if (!unifiedUserId || typeof unifiedUserId !== "string") {
    logger.error({ unifiedUserId }, "Invalid unifiedUserId for getStats");
    return null;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("get_referral_stats", {
    p_unified_user_id: unifiedUserId,
  });

  if (error) {
    logger.error({ unifiedUserId, error }, "Failed to get_referral_stats");
    return null;
  }

  // jsonb RPC: data is already a parsed object.
  if (!data || typeof data !== "object") {
    logger.warn({ unifiedUserId, data }, "Unexpected referral stats RPC response");
    return null;
  }

  const row = data as Partial<ReferralStats>;
  return {
    code: typeof row.code === "string" ? row.code : null,
    invited: Number(row.invited ?? 0),
    activated: Number(row.activated ?? 0),
    credits_earned: Number(row.credits_earned ?? 0),
    pending: Number(row.pending ?? 0),
  };
}

// =============================================================================
// MUTATING OPERATIONS (return { ok, reason? }; never throw)
// =============================================================================

/**
 * Capture a referral when a (new) referee taps a deep link.
 *
 * @param code - Referral code from the deep link
 * @param refereeTelegramId - Telegram id of the user who clicked the link
 * @returns `{ ok, reason? }` — reason in invalid_code|self_referral|not_new_user|already_captured|rpc_error
 */
export async function captureReferral(
  code: string,
  refereeTelegramId: number
): Promise<ReferralRpcResult> {
  if (!code || typeof code !== "string") {
    logger.error({ code }, "Invalid code for captureReferral");
    return { ok: false, reason: "invalid_code" };
  }
  if (!Number.isInteger(refereeTelegramId) || refereeTelegramId <= 0) {
    logger.error({ refereeTelegramId }, "Invalid refereeTelegramId for captureReferral");
    return RPC_ERROR_RESULT;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("capture_referral", {
    p_code: code,
    p_referee_telegram_id: refereeTelegramId,
  });

  if (error) {
    logger.error({ code, refereeTelegramId, error }, "Failed to capture_referral");
    return RPC_ERROR_RESULT;
  }

  return normalizeRpcResult(data, { code, refereeTelegramId }, "capture_referral");
}

/**
 * Attribute a captured referral once the referee finishes signup/onboarding.
 *
 * @param refereeTelegramId - Telegram id of the referee
 * @param refereeUnifiedUserId - unified_users.id of the referee (uuid)
 * @returns `{ ok, reason?, credited? }` — reason: 'no_pending'|'rpc_error'
 */
export async function attributeRefereeSignup(
  refereeTelegramId: number,
  refereeUnifiedUserId: string
): Promise<ReferralRpcResult> {
  if (!Number.isInteger(refereeTelegramId) || refereeTelegramId <= 0) {
    logger.error({ refereeTelegramId }, "Invalid refereeTelegramId for attributeRefereeSignup");
    return RPC_ERROR_RESULT;
  }
  if (!refereeUnifiedUserId || typeof refereeUnifiedUserId !== "string") {
    logger.error(
      { refereeUnifiedUserId },
      "Invalid refereeUnifiedUserId for attributeRefereeSignup"
    );
    return RPC_ERROR_RESULT;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("attribute_referee_signup", {
    p_referee_telegram_id: refereeTelegramId,
    p_referee_unified_user_id: refereeUnifiedUserId,
  });

  if (error) {
    logger.error(
      { refereeTelegramId, refereeUnifiedUserId, error },
      "Failed to attribute_referee_signup"
    );
    return RPC_ERROR_RESULT;
  }

  return normalizeRpcResult(
    data,
    { refereeTelegramId, refereeUnifiedUserId },
    "attribute_referee_signup"
  );
}

/**
 * Reward the referrer once the referee activates (e.g. first completed analysis).
 * The underlying RPC is idempotent and enforces a monthly reward limit.
 *
 * @param refereeTelegramId - Telegram id of the referee
 * @returns `{ ok, reason?, credited? }` — reason: 'nothing_to_reward'|'monthly_limit'|'rpc_error'
 */
export async function rewardReferrerOnActivation(
  refereeTelegramId: number
): Promise<ReferralRpcResult> {
  if (!Number.isInteger(refereeTelegramId) || refereeTelegramId <= 0) {
    logger.error(
      { refereeTelegramId },
      "Invalid refereeTelegramId for rewardReferrerOnActivation"
    );
    return RPC_ERROR_RESULT;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("reward_referrer_on_activation", {
    p_referee_telegram_id: refereeTelegramId,
  });

  if (error) {
    logger.error({ refereeTelegramId, error }, "Failed to reward_referrer_on_activation");
    return RPC_ERROR_RESULT;
  }

  return normalizeRpcResult(data, { refereeTelegramId }, "reward_referrer_on_activation");
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Normalize a jsonb RPC response into a {@link ReferralRpcResult}.
 *
 * supabase-js returns jsonb already parsed; a SETOF/table-returning RPC may be
 * wrapped in an array. We defensively unwrap arrays and coerce fields.
 */
function normalizeRpcResult(
  data: unknown,
  context: Record<string, unknown>,
  op: string
): ReferralRpcResult {
  const row = Array.isArray(data) ? data[0] : data;

  if (!row || typeof row !== "object") {
    logger.warn({ ...context, data, op }, "Unexpected referral RPC response shape");
    return RPC_ERROR_RESULT;
  }

  const obj = row as { ok?: unknown; reason?: unknown; credited?: unknown };
  const result: ReferralRpcResult = { ok: obj.ok === true };
  if (typeof obj.reason === "string") {
    result.reason = obj.reason;
  }
  if (obj.credited !== undefined && obj.credited !== null && !Number.isNaN(Number(obj.credited))) {
    result.credited = Number(obj.credited);
  }

  logger.debug({ ...context, result, op }, "Referral RPC completed");
  return result;
}
