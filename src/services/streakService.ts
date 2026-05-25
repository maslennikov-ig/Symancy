// services/streakService.ts
// Service for reading the user's daily-usage streak (sym-tb3, gamification)

import { supabase, createSupabaseWithToken } from '../lib/supabaseClient';
import { getStoredToken } from './authService';
import { createLogger } from '../lib/logger';

const log = createLogger('streakService');

/**
 * User streak state mirrored from the `user_streaks` table.
 */
export interface UserStreak {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null;
}

/**
 * Get the appropriate Supabase client based on auth type.
 * Uses custom JWT for Telegram users, default client for Supabase Auth users.
 */
function getClient() {
  const telegramToken = getStoredToken();
  return telegramToken ? createSupabaseWithToken(telegramToken) : supabase;
}

/**
 * Fetch the current user's streak.
 *
 * RLS restricts the row to the authenticated user (Supabase Auth or Telegram
 * JWT), so an explicit user-id filter is not required. Returns null if the
 * user has no streak row yet (e.g. never completed an analysis).
 *
 * @param unifiedUserId - Optional unified_user_id; used to scope the query for
 *                        Telegram users when provided.
 * @returns The user's streak, or null if none exists
 */
export async function getUserStreak(unifiedUserId?: string): Promise<UserStreak | null> {
  const client = getClient();

  let query = client
    .from('user_streaks')
    .select('current_streak, longest_streak, last_activity_date');

  if (unifiedUserId) {
    query = query.eq('unified_user_id', unifiedUserId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    log.error('Failed to fetch user streak', error);
    return null;
  }

  if (!data) {
    return null;
  }

  return {
    currentStreak: data.current_streak ?? 0,
    longestStreak: data.longest_streak ?? 0,
    lastActivityDate: data.last_activity_date ?? null,
  };
}
