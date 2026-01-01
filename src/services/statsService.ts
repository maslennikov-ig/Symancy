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

      // Count completed analyses for this unified user
      const { count: analysesCount, error: analysesError } = await client
        .from('analysis_history')
        .select('*', { count: 'exact', head: true })
        .eq('unified_user_id', unifiedUserId)
        .eq('status', 'completed');

      if (!analysesError && analysesCount !== null) {
        stats.analysesCount = analysesCount;
      }

      // Count messages via conversations table (uses message_count field)
      const { data: conversations, error: convError } = await client
        .from('conversations')
        .select('message_count')
        .eq('unified_user_id', unifiedUserId);

      if (!convError && conversations) {
        stats.messagesCount = conversations.reduce(
          (sum, c) => sum + (c.message_count || 0),
          0
        );
      }

      // Sum credits used from successful purchases for this unified user
      const { data: purchases, error: purchasesError } = await client
        .from('purchases')
        .select('credits_granted')
        .eq('unified_user_id', unifiedUserId)
        .eq('status', 'succeeded');

      if (!purchasesError && purchases) {
        stats.creditsUsed = purchases.reduce(
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

    // Count completed analyses for auth user
    // Note: analysis_history uses telegram_user_id, not auth user_id
    // For web users, we need to check if they have a linked unified_user
    const { count: analysesCount, error: analysesError } = await supabase
      .from('analysis_history')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed');

    if (!analysesError && analysesCount !== null) {
      stats.analysesCount = analysesCount;
    }

    // Count messages via conversations table
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('message_count');

    if (!convError && conversations) {
      stats.messagesCount = conversations.reduce(
        (sum, c) => sum + (c.message_count || 0),
        0
      );
    }

    // Sum credits used from successful purchases
    const { data: purchases, error: purchasesError } = await supabase
      .from('purchases')
      .select('credits_granted')
      .eq('user_id', user.id)
      .eq('status', 'succeeded');

    if (!purchasesError && purchases) {
      stats.creditsUsed = purchases.reduce(
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
