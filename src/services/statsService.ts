/**
 * Statistics Service
 *
 * Fetches user statistics from Supabase for the Profile page.
 * Supports both Supabase Auth users and Telegram JWT users via omnichannel tables.
 *
 * @module services/statsService
 */
import { supabase, createSupabaseWithToken } from '../lib/supabaseClient';
import { getStoredToken } from './authService';

export interface UserStats {
  analysesCount: number;
  messagesCount: number;
  creditsUsed: number;
}

/**
 * Get user statistics from database.
 * Uses unified_user_id for omnichannel users (Telegram).
 * Falls back to Supabase Auth user for web users.
 *
 * @param unifiedUserId - Optional unified user ID (for Telegram users)
 * @returns Promise with UserStats
 */
export async function getUserStats(unifiedUserId?: string): Promise<UserStats> {
  // Default stats if no data
  const stats: UserStats = {
    analysesCount: 0,
    messagesCount: 0,
    creditsUsed: 0,
  };

  try {
    // Check for Telegram JWT token first
    const telegramToken = getStoredToken();

    if (telegramToken && unifiedUserId) {
      // Use custom Supabase client with Telegram JWT for RLS
      const client = createSupabaseWithToken(telegramToken);

      // First, get the telegram_id from unified_users table
      // This is needed because analysis_history stores telegram_user_id, not unified_user_id
      const { data: unifiedUserData, error: userError } = await client
        .from('unified_users')
        .select('telegram_id')
        .eq('id', unifiedUserId)
        .single();

      if (userError) {
        console.warn('[statsService] Failed to fetch unified user:', userError);
        return stats; // Return default stats
      }

      const telegramUserId = unifiedUserData?.telegram_id;

      if (!telegramUserId) {
        console.warn('[statsService] No telegram_id found for unified user:', unifiedUserId);
        return stats; // Return default stats - analysis_history requires telegram_user_id
      }

      // Run all queries in parallel for better performance
      const [analysesResult, conversationsResult, purchasesResult] =
        await Promise.all([
          // Count completed analyses by telegram_user_id (always populated in analysis_history)
          client
            .from('analysis_history')
            .select('*', { count: 'exact', head: true })
            .eq('telegram_user_id', telegramUserId)
            .eq('status', 'completed'),
          // Count messages via conversations table (uses message_count field)
          client
            .from('conversations')
            .select('message_count')
            .eq('unified_user_id', unifiedUserId),
          // Sum credits used from successful purchases for this unified user
          client
            .from('purchases')
            .select('credits_granted')
            .eq('unified_user_id', unifiedUserId)
            .eq('status', 'succeeded'),
        ]);

      // Process results
      if (!analysesResult.error && analysesResult.count !== null) {
        stats.analysesCount = analysesResult.count;
      }

      if (!conversationsResult.error && conversationsResult.data) {
        stats.messagesCount = conversationsResult.data.reduce(
          (sum, c) => sum + (c.message_count || 0),
          0
        );
      }

      if (!purchasesResult.error && purchasesResult.data) {
        stats.creditsUsed = purchasesResult.data.reduce(
          (sum, p) => sum + (p.credits_granted || 0),
          0
        );
      }

      return stats;
    }

    // Fall back to Supabase Auth user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.warn('[statsService] No authenticated user found');
      return stats;
    }

    // Run all queries in parallel for better performance
    // Note: analysis_history uses telegram_user_id, not auth user_id
    // For web users, we need to check if they have a linked unified_user
    const [analysesResult, conversationsResult, purchasesResult] =
      await Promise.all([
        // Count completed analyses for auth user
        supabase
          .from('analysis_history')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'completed'),
        // Count messages via conversations table
        supabase.from('conversations').select('message_count'),
        // Sum credits used from successful purchases
        supabase
          .from('purchases')
          .select('credits_granted')
          .eq('user_id', user.id)
          .eq('status', 'succeeded'),
      ]);

    // Process results
    if (!analysesResult.error && analysesResult.count !== null) {
      stats.analysesCount = analysesResult.count;
    }

    if (!conversationsResult.error && conversationsResult.data) {
      stats.messagesCount = conversationsResult.data.reduce(
        (sum, c) => sum + (c.message_count || 0),
        0
      );
    }

    if (!purchasesResult.error && purchasesResult.data) {
      stats.creditsUsed = purchasesResult.data.reduce(
        (sum, p) => sum + (p.credits_granted || 0),
        0
      );
    }

    return stats;
  } catch (error) {
    console.error('[statsService] Failed to fetch stats:', error);
    return stats;
  }
}
