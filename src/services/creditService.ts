// services/creditService.ts
// Credit management service for checking and consuming credits (Feature 002-pre-mvp-payments)

import { supabase } from '../lib/supabaseClient';
import { getUserCredits } from './paymentService';
import { getActiveSubscription } from './subscriptionService';

/**
 * Welcome gift granted to new users on first onboarding completion.
 * MUST stay in sync with WELCOME_GIFT in symancy-backend/src/modules/credits/service.ts.
 */
export const WELCOME_GIFT = {
  basic: 3,
  pro: 1,
  cassandra: 0,
} as const;

export interface ClaimWelcomeResult {
  success: boolean;
  alreadyGranted: boolean;
  granted: { basic: number; pro: number; cassandra: number };
  balance: { basic: number; pro: number; cassandra: number };
  error?: string;
}

/**
 * Claim welcome credits (3 basic + 1 pro) for the currently authenticated user.
 * Idempotent: subsequent calls are no-ops via the `free_credit_granted` flag.
 *
 * Flow:
 *   1. Look up the current user's `unified_users` row by `auth_id`.
 *   2. Invoke the `grant_unified_initial_credits` RPC with WELCOME_GIFT amounts.
 */
export async function claimWelcomeCredits(): Promise<ClaimWelcomeResult> {
  const empty = {
    granted: { basic: 0, pro: 0, cassandra: 0 },
    balance: { basic: 0, pro: 0, cassandra: 0 },
  };

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    return { success: false, alreadyGranted: false, ...empty, error: authError?.message ?? 'Not authenticated' };
  }

  const { data: unifiedUser, error: unifiedError } = await supabase
    .from('unified_users')
    .select('id')
    .eq('auth_id', authData.user.id)
    .single();

  if (unifiedError || !unifiedUser) {
    return {
      success: false,
      alreadyGranted: false,
      ...empty,
      error: unifiedError?.message ?? 'Unified user record not found',
    };
  }

  const { data, error: rpcError } = await supabase.rpc('grant_unified_initial_credits', {
    p_unified_user_id: unifiedUser.id,
    p_basic: WELCOME_GIFT.basic,
    p_pro: WELCOME_GIFT.pro,
    p_cassandra: WELCOME_GIFT.cassandra,
  });

  if (rpcError) {
    return { success: false, alreadyGranted: false, ...empty, error: rpcError.message };
  }

  // RPC returns a single-row table
  const row = (Array.isArray(data) ? data[0] : data) as
    | {
        basic_granted: number;
        pro_granted: number;
        cassandra_granted: number;
        already_granted: boolean;
        new_basic: number;
        new_pro: number;
        new_cassandra: number;
      }
    | null;

  if (!row) {
    return { success: false, alreadyGranted: false, ...empty, error: 'Empty RPC response' };
  }

  return {
    success: true,
    alreadyGranted: row.already_granted,
    granted: { basic: row.basic_granted, pro: row.pro_granted, cassandra: row.cassandra_granted },
    balance: { basic: row.new_basic, pro: row.new_pro, cassandra: row.new_cassandra },
  };
}

/**
 * Result of consuming a credit
 */
export interface ConsumeResult {
  success: boolean;
  credit_type: 'basic' | 'pro' | 'cassandra' | null;
  remaining: number;
  error?: string;
}

/**
 * Check if user has available credits for analysis.
 * Checks basic and pro credits (not cassandra, which is special).
 *
 * @returns Promise<boolean> - true if user has any basic or pro credits
 */
export async function hasAvailableCredits(): Promise<boolean> {
  const credits = await getUserCredits();
  if (!credits) return false;
  return credits.basic_credits > 0 || credits.pro_credits > 0;
}

/**
 * Check if user has credits of specific type.
 * For 'basic' type, checks both basic_credits and pro_credits (pro can be used for basic).
 * For 'cassandra' type, only checks cassandra_credits.
 *
 * @param type - Credit type to check ('basic' or 'cassandra')
 * @returns Promise<boolean> - true if user has credits of the specified type
 */
export async function hasCreditsOfType(type: 'basic' | 'cassandra'): Promise<boolean> {
  const credits = await getUserCredits();
  if (!credits) return false;

  if (type === 'basic') {
    // Both basic and pro credits can be used for basic analysis
    return credits.basic_credits > 0 || credits.pro_credits > 0;
  }
  return credits.cassandra_credits > 0;
}

/**
 * Consume a credit for analysis.
 * Calls the consume_credit RPC function in the database.
 * Priority for 'basic' type: basic_credits -> pro_credits
 *
 * @param creditType - Type of credit to consume ('basic' or 'cassandra'), defaults to 'basic'
 * @returns Promise<ConsumeResult> - Result with success status, credit type used, and remaining credits
 */
export async function consumeCredit(
  creditType: 'basic' | 'cassandra' = 'basic'
): Promise<ConsumeResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, credit_type: null, remaining: 0, error: 'Not authenticated' };
  }

  const { data, error } = await supabase.rpc('consume_credit', {
    p_user_id: user.id,
    p_credit_type: creditType
  });

  if (error) {
    console.error('Error consuming credit:', error);
    return {
      success: false,
      credit_type: null,
      remaining: 0,
      error: error.message || 'Failed to consume credit'
    };
  }

  // RPC returns array with single row
  const result = data?.[0];
  return {
    success: result?.success ?? false,
    credit_type: result?.credit_type ?? null,
    remaining: result?.remaining ?? 0,
  };
}

/**
 * Check if user has PRO access via an active subscription (advanced or premium tier).
 *
 * @returns Promise<boolean> - true if user has active advanced or premium subscription
 */
export async function hasProAccessViaSubscription(): Promise<boolean> {
  const subscription = await getActiveSubscription();
  if (!subscription) return false;
  const hasProTier = subscription.tier === 'advanced' || subscription.tier === 'premium';
  if (subscription.status === 'active') return hasProTier;
  if (subscription.status === 'past_due' && subscription.grace_period_end) {
    return hasProTier && new Date(subscription.grace_period_end) > new Date();
  }
  return false;
}

/**
 * Get total available credits for regular analysis (basic + pro, not cassandra).
 * Cassandra credits are separate and not counted here.
 *
 * @returns Promise<number> - Total number of basic + pro credits
 */
export async function getTotalAvailableCredits(): Promise<number> {
  const credits = await getUserCredits();
  if (!credits) return 0;
  return credits.basic_credits + credits.pro_credits;
}
