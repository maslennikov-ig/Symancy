// lib/moodUtils.ts
// Shared utility functions for Mood Diary feature

/** Minimum mood score value */
export const MOOD_SCORE_MIN = 1;

/** Maximum mood score value */
export const MOOD_SCORE_MAX = 10;

/**
 * Maps a mood score (1-10) to an HSL color from red to green.
 * Used across MoodScorePicker, MoodPromptCard, MoodCalendar, MoodStats.
 */
export function getScoreColor(score: number): string {
  if (score <= 2) return 'hsl(0, 70%, 55%)';
  if (score <= 4) return 'hsl(30, 80%, 55%)';
  if (score <= 6) return 'hsl(50, 80%, 50%)';
  if (score <= 8) return 'hsl(90, 60%, 45%)';
  return 'hsl(120, 50%, 45%)';
}
