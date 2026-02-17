// hooks/useMoodEntry.ts
// React hook for managing today's mood entry (sym-243)

import { useState, useEffect, useCallback } from 'react';
import { getTodayMood, saveTodayMood } from '../services/moodService';
import type { MoodEntry, MoodEntryInput } from '../types/mood';

/**
 * Hook for loading and saving today's mood entry.
 *
 * Automatically fetches today's entry on mount. Provides a `save` function
 * to create or update the entry, and `refetch` to reload manually.
 *
 * @returns Object with todayEntry, loading/error state, save, and refetch
 *
 * @example
 * ```tsx
 * function MoodForm() {
 *   const { todayEntry, isLoading, error, save } = useMoodEntry();
 *
 *   if (isLoading) return <p>Loading...</p>;
 *   if (todayEntry) return <p>Score: {todayEntry.score}</p>;
 *
 *   return <button onClick={() => save({ score: 7, emotions: ['happy'] })}>Save</button>;
 * }
 * ```
 */
export function useMoodEntry() {
  const [todayEntry, setTodayEntry] = useState<MoodEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchToday = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const entry = await getTodayMood();
      setTodayEntry(entry);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load mood');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchToday();
  }, [fetchToday]);

  const save = useCallback(async (input: MoodEntryInput) => {
    const result = await saveTodayMood(input);
    setTodayEntry(result);
    return result;
  }, []);

  return { todayEntry, isLoading, error, save, refetch: fetchToday };
}
