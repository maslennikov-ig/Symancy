// supabase/functions/_shared/unified-credits.ts
//
// Shared unified-credit helpers for Supabase Edge Functions (Deno).
// Single source of truth for credit consume/refund against `unified_user_credits`,
// keyed through `unified_users` (auth_id → unified_user_id + telegram_id).
//
// Lifted verbatim (logic) from the proven `compare-coffee/index.ts` pattern so all
// web edge functions share one race-safe implementation (DRY).
//
// Credit flow:
//   - Telegram-linked users  → consume_unified_credit / refund_unified_credit (by telegram_id)
//   - Web-only users         → *_by_unified_user_id variants (by unified_user_id)
// All four RPCs are SECURITY DEFINER → MUST be called with a service-role client.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type CreditType = "basic" | "pro" | "cassandra";

export interface UnifiedUserLookup {
  unifiedUserId: string;
  telegramId: number | null;
}

export interface CreditOpResult {
  success: boolean;
  remaining: number | null;
  reason?: string;
}

/** Resolve unified_user_id (+ telegram_id) from an auth user id. */
export async function resolveUnifiedUser(
  serviceClient: SupabaseClient,
  authId: string,
): Promise<UnifiedUserLookup | null> {
  const { data, error } = await serviceClient
    .from("unified_users")
    .select("id, telegram_id")
    .eq("auth_id", authId)
    .single();
  if (error || !data) {
    console.error("resolveUnifiedUser failed", { authId, error });
    return null;
  }
  return {
    unifiedUserId: data.id as string,
    telegramId: data.telegram_id == null ? null : Number(data.telegram_id),
  };
}

/** Consume one credit of `creditType` via the race-safe unified RPCs. */
export async function consumeCreditForAuthUser(
  serviceClient: SupabaseClient,
  user: UnifiedUserLookup,
  creditType: CreditType,
): Promise<CreditOpResult> {
  if (user.telegramId != null) {
    const { data, error } = await serviceClient.rpc("consume_unified_credit", {
      p_telegram_id: user.telegramId,
      p_credit_type: creditType,
    });
    if (error) {
      console.error("consume_unified_credit RPC error", error);
      return { success: false, remaining: null, reason: error.message };
    }
    const row = Array.isArray(data) ? data[0] : data;
    return {
      success: !!row?.success,
      remaining: typeof row?.remaining === "number" ? row.remaining : null,
    };
  }

  const { data, error } = await serviceClient.rpc(
    "consume_unified_credit_by_unified_user_id",
    {
      p_unified_user_id: user.unifiedUserId,
      p_credit_type: creditType,
    },
  );
  if (error) {
    console.error("consume_unified_credit_by_unified_user_id RPC error", error);
    return { success: false, remaining: null, reason: error.message };
  }
  const row = Array.isArray(data) ? data[0] : data;
  return {
    success: !!row?.success,
    remaining: typeof row?.remaining === "number" ? row.remaining : null,
  };
}

/** Refund one credit. Best-effort: logs on failure, never throws. */
export async function refundCreditForAuthUser(
  serviceClient: SupabaseClient,
  user: UnifiedUserLookup,
  creditType: CreditType,
): Promise<void> {
  try {
    if (user.telegramId != null) {
      const { error } = await serviceClient.rpc("refund_unified_credit", {
        p_telegram_id: user.telegramId,
        p_credit_type: creditType,
      });
      if (error) console.error("refund_unified_credit error", error);
      return;
    }
    const { error } = await serviceClient.rpc(
      "refund_unified_credit_by_unified_user_id",
      {
        p_unified_user_id: user.unifiedUserId,
        p_credit_type: creditType,
      },
    );
    if (error) {
      console.error("refund_unified_credit_by_unified_user_id error", error);
    }
  } catch (e) {
    console.error("Refund threw", e);
  }
}
