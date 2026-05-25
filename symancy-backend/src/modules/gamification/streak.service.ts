/**
 * Streak Service (Gamification)
 *
 * Tracks a user's consecutive-day usage streak. The streak is extended once
 * per calendar day when the user completes a streak-counting activity
 * (currently: a successful coffee-ground photo analysis).
 *
 * The heavy lifting (increment / extend / reset, longest-streak bookkeeping,
 * per-day idempotency) lives in the `increment_user_streak` SECURITY DEFINER
 * RPC. This service only resolves the unified_user_id and calls the RPC.
 *
 * Design notes:
 * - The photo-analysis worker only knows the Telegram user id, so we resolve
 *   the unified_user_id from `unified_users` first.
 * - Failures here are non-fatal: streak tracking must never break the core
 *   analysis flow, so callers should treat a null/failed result as a no-op.
 */
import { getSupabase } from "../../core/database.js";
import { getLogger } from "../../core/logger.js";

const logger = getLogger().child({ module: "gamification-streak" });

/**
 * Resulting streak state returned by `increment_user_streak`.
 */
export interface StreakState {
  unifiedUserId: string;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null;
}

/**
 * Raw row shape returned by the `increment_user_streak` RPC / user_streaks table.
 */
interface RawStreakRow {
  unified_user_id: string;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
}

/**
 * Resolve the unified_user_id for a given Telegram user id.
 *
 * @param telegramUserId - Telegram numeric user id
 * @returns unified_user_id UUID, or null if the user is not (yet) in unified_users
 */
async function resolveUnifiedUserId(telegramUserId: number): Promise<string | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("unified_users")
    .select("id")
    .eq("telegram_id", telegramUserId)
    .maybeSingle();

  if (error) {
    logger.warn({ telegramUserId, error }, "Failed to resolve unified_user_id for streak");
    return null;
  }

  return (data?.id as string | undefined) ?? null;
}

/**
 * Record a streak-counting activity for a unified user.
 *
 * Idempotent per calendar day (the RPC ignores repeat calls on the same day).
 * Never throws — returns null on any failure so the caller's main flow is safe.
 *
 * @param unifiedUserId - unified_users.id UUID
 * @returns the resulting streak state, or null on failure
 */
export async function recordStreakActivity(unifiedUserId: string): Promise<StreakState | null> {
  if (!unifiedUserId) {
    logger.warn("recordStreakActivity called without unifiedUserId");
    return null;
  }

  const supabase = getSupabase();

  try {
    const { data, error } = await supabase.rpc("increment_user_streak", {
      p_unified_user_id: unifiedUserId,
    });

    if (error) {
      logger.warn({ unifiedUserId, error }, "increment_user_streak RPC failed");
      return null;
    }

    // The RPC returns a single user_streaks row. supabase-js may surface it as
    // an object or a single-element array depending on the function signature.
    const row = (Array.isArray(data) ? data[0] : data) as RawStreakRow | null;

    if (!row) {
      logger.warn({ unifiedUserId }, "increment_user_streak returned no row");
      return null;
    }

    const state: StreakState = {
      unifiedUserId: row.unified_user_id,
      currentStreak: row.current_streak,
      longestStreak: row.longest_streak,
      lastActivityDate: row.last_activity_date,
    };

    logger.info(
      { unifiedUserId, currentStreak: state.currentStreak, longestStreak: state.longestStreak },
      "Streak activity recorded"
    );

    return state;
  } catch (err) {
    logger.warn({ unifiedUserId, err }, "Unexpected error recording streak activity");
    return null;
  }
}

/**
 * Record a streak-counting activity by Telegram user id.
 *
 * Convenience wrapper used by the photo-analysis worker, which only has the
 * Telegram user id. Resolves the unified_user_id first, then delegates to
 * {@link recordStreakActivity}. Never throws.
 *
 * @param telegramUserId - Telegram numeric user id
 * @returns the resulting streak state, or null if the user could not be
 *          resolved or the update failed
 */
export async function recordStreakActivityForTelegramUser(
  telegramUserId: number
): Promise<StreakState | null> {
  if (!Number.isInteger(telegramUserId) || telegramUserId <= 0) {
    logger.warn({ telegramUserId }, "Invalid telegram user id for streak");
    return null;
  }

  const unifiedUserId = await resolveUnifiedUserId(telegramUserId);
  if (!unifiedUserId) {
    logger.debug(
      { telegramUserId },
      "No unified_user_id found for Telegram user, skipping streak update"
    );
    return null;
  }

  return recordStreakActivity(unifiedUserId);
}
