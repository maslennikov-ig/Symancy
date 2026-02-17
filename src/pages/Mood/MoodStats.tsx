/**
 * MoodStats Component
 *
 * Mini stats bar showing weekly average, monthly average,
 * current streak, and most frequent emotion.
 *
 * @module pages/Mood/MoodStats
 */
import React, { useMemo } from 'react';
import { EMOTIONS } from '../../types/mood';
import { getScoreColor } from '../../lib/moodUtils';
import type { MoodEntry, EmotionTag } from '../../types/mood';

interface MoodStatsProps {
  /** All entries to compute stats from */
  entries: MoodEntry[];
  /** Translation function */
  t: (key: string) => string;
}

/**
 * Get start of the current week (Monday)
 */
function getWeekStart(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1; // Monday = 0
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - diff);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

/**
 * Calculate consecutive day streak up to today.
 * If today has no entry, starts counting from yesterday.
 */
function calculateStreak(entries: MoodEntry[]): number {
  if (entries.length === 0) return 0;

  const dateSet = new Set(entries.map((e) => e.date));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Start from today if entry exists, otherwise from yesterday
  const checkDate = new Date(today);
  if (!dateSet.has(todayStr)) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const dateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;

    if (dateSet.has(dateStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Find most frequent emotion across entries
 */
function getMostFrequentEmotion(
  entries: MoodEntry[],
): EmotionTag | null {
  const counts = new Map<EmotionTag, number>();

  for (const entry of entries) {
    for (const emotion of entry.emotions) {
      counts.set(emotion, (counts.get(emotion) ?? 0) + 1);
    }
  }

  if (counts.size === 0) return null;

  let maxCount = 0;
  let maxEmotion: EmotionTag | null = null;

  for (const [emotion, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      maxEmotion = emotion;
    }
  }

  return maxEmotion;
}

function MoodStatsComponent({ entries, t }: MoodStatsProps) {
  const stats = useMemo(() => {
    if (entries.length === 0) {
      return null;
    }

    const weekStart = getWeekStart();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const weekEntries = entries.filter(
      (e) => new Date(e.date) >= weekStart,
    );
    const monthEntries = entries.filter(
      (e) => new Date(e.date) >= monthStart,
    );

    const weeklyAvg =
      weekEntries.length > 0
        ? weekEntries.reduce((sum, e) => sum + e.score, 0) /
          weekEntries.length
        : null;

    const monthlyAvg =
      monthEntries.length > 0
        ? monthEntries.reduce((sum, e) => sum + e.score, 0) /
          monthEntries.length
        : null;

    const streak = calculateStreak(entries);
    const topEmotion = getMostFrequentEmotion(entries);

    return {
      weeklyAvg,
      monthlyAvg,
      streak,
      topEmotion,
    };
  }, [entries]);

  if (!stats) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 text-center">
        <p className="text-sm text-muted-foreground">
          {t('mood.stats.empty')}
        </p>
      </div>
    );
  }

  const topEmotionDef = stats.topEmotion
    ? EMOTIONS.find((e) => e.id === stats.topEmotion)
    : null;

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="grid grid-cols-2 gap-3">
        {/* Weekly Average */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-muted-foreground">
            {t('mood.stats.weeklyAvg')}
          </span>
          {stats.weeklyAvg !== null ? (
            <span
              className="text-lg font-bold"
              style={{ color: getScoreColor(Math.round(stats.weeklyAvg)) }}
            >
              {stats.weeklyAvg.toFixed(1)}
            </span>
          ) : (
            <span className="text-lg font-bold text-muted-foreground">
              --
            </span>
          )}
        </div>

        {/* Monthly Average */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-muted-foreground">
            {t('mood.stats.monthlyAvg')}
          </span>
          {stats.monthlyAvg !== null ? (
            <span
              className="text-lg font-bold"
              style={{ color: getScoreColor(Math.round(stats.monthlyAvg)) }}
            >
              {stats.monthlyAvg.toFixed(1)}
            </span>
          ) : (
            <span className="text-lg font-bold text-muted-foreground">
              --
            </span>
          )}
        </div>

        {/* Streak */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-muted-foreground">
            {t('mood.stats.streak')}
          </span>
          <span className="text-lg font-bold text-foreground">
            {stats.streak}
          </span>
        </div>

        {/* Most Frequent Emotion */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-muted-foreground">
            {t('mood.stats.topEmotion')}
          </span>
          {topEmotionDef ? (
            <span className="text-lg">
              <span aria-hidden="true">{topEmotionDef.emoji}</span>{' '}
              <span className="text-sm font-medium text-foreground">
                {t(topEmotionDef.labelKey)}
              </span>
            </span>
          ) : (
            <span className="text-lg font-bold text-muted-foreground">
              --
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default React.memo(MoodStatsComponent);
