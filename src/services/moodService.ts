// services/moodService.ts
// Service for Mood Diary CRUD operations (sym-243)

import { supabase, createSupabaseWithToken } from '../lib/supabaseClient';
import { getStoredToken } from './authService';
import type { MoodEntry, MoodEntryInput, EmotionTag } from '../types/mood';

/**
 * Get the appropriate Supabase client based on auth type.
 * Uses custom JWT for Telegram users, default client for Supabase Auth users.
 */
function getClient() {
  const telegramToken = getStoredToken();
  return telegramToken ? createSupabaseWithToken(telegramToken) : supabase;
}

/**
 * Get today's date as YYYY-MM-DD string in the local timezone.
 */
function getTodayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Save or update today's mood entry via the upsert_mood_entry RPC.
 *
 * @param input - Mood entry data (score, emotions, optional note)
 * @returns The saved MoodEntry
 * @throws Error if not authenticated or RPC fails
 */
export async function saveTodayMood(input: MoodEntryInput): Promise<MoodEntry> {
  const client = getClient();

  const { data, error } = await client.rpc('upsert_mood_entry', {
    p_score: input.score,
    p_emotions: input.emotions,
    p_note: input.note || null,
    p_source: 'mini_app',
  });

  if (error) {
    console.error('Error saving mood entry:', error);
    throw new Error(error.message);
  }

  return data as MoodEntry;
}

/**
 * Get today's mood entry if it exists.
 *
 * @returns Today's MoodEntry or null if none exists
 * @throws Error if query fails
 */
export async function getTodayMood(): Promise<MoodEntry | null> {
  const client = getClient();
  const today = getTodayISO();

  const { data, error } = await client
    .from('mood_entries')
    .select('*')
    .eq('date', today)
    .maybeSingle();

  if (error) {
    console.error('Error fetching today mood:', error);
    throw new Error(error.message);
  }

  return data as MoodEntry | null;
}

/**
 * Get mood history within a date range.
 * Defaults to the last 31 days if no range is specified.
 *
 * @param startDate - Start date (YYYY-MM-DD), defaults to 31 days ago
 * @param endDate - End date (YYYY-MM-DD), defaults to today
 * @returns Array of MoodEntry sorted by date descending
 * @throws Error if query fails
 */
export async function getMoodHistory(
  startDate?: string,
  endDate?: string,
): Promise<MoodEntry[]> {
  const client = getClient();

  const end = endDate || getTodayISO();
  const start = startDate || (() => {
    const d = new Date();
    d.setDate(d.getDate() - 31);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  })();

  const { data, error } = await client
    .from('mood_entries')
    .select('*')
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: false });

  if (error) {
    console.error('Error fetching mood history:', error);
    throw new Error(error.message);
  }

  return (data || []) as MoodEntry[];
}

/**
 * Compute mood statistics over the specified number of days.
 *
 * @param days - Number of days to look back (default: 7)
 * @returns Object with averageScore, entry count, and top 3 emotions
 */
export async function getMoodStats(
  days: number = 7,
): Promise<{ averageScore: number; entries: number; topEmotions: EmotionTag[] }> {
  const end = getTodayISO();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const start = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;

  const entries = await getMoodHistory(start, end);

  if (entries.length === 0) {
    return { averageScore: 0, entries: 0, topEmotions: [] };
  }

  // Average score
  const totalScore = entries.reduce((sum, e) => sum + e.score, 0);
  const averageScore = Math.round((totalScore / entries.length) * 10) / 10;

  // Count emotion frequencies
  const emotionCounts = new Map<EmotionTag, number>();
  for (const entry of entries) {
    for (const emotion of entry.emotions) {
      emotionCounts.set(emotion, (emotionCounts.get(emotion) || 0) + 1);
    }
  }

  // Sort by frequency descending, take top 3
  const topEmotions = Array.from(emotionCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([emotion]) => emotion);

  return { averageScore, entries: entries.length, topEmotions };
}
