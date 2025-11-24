// services/creditService.ts
// Credit management service for checking and consuming credits (Feature 002-pre-mvp-payments)

import { supabase } from '../lib/supabaseClient';
import { getUserCredits } from './paymentService';

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
