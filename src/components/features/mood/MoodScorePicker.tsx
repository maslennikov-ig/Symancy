/**
 * MoodScorePicker Component
 *
 * A horizontal row of 10 circular buttons for selecting a mood score (1-10).
 * Each button has a color on the red-to-green scale based on score value.
 * Selected button is larger with a ring border.
 *
 * @module components/features/mood/MoodScorePicker
 */
import React, { useCallback } from 'react';
import { useTelegramWebApp } from '../../../hooks/useTelegramWebApp';
import { getScoreColor, MOOD_SCORE_MIN, MOOD_SCORE_MAX } from '../../../lib/moodUtils';

interface MoodScorePickerProps {
  /** Currently selected score (null if none) */
  value: number | null;
  /** Callback when a score is selected */
  onChange: (score: number) => void;
  /** Translation function */
  t: (key: string) => string;
}

function MoodScorePickerComponent({ value, onChange, t }: MoodScorePickerProps) {
  const { hapticFeedback } = useTelegramWebApp();

  const handleSelect = useCallback(
    (score: number) => {
      hapticFeedback.selection();
      onChange(score);
    },
    [onChange, hapticFeedback],
  );

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-foreground">
        {t('mood.entry.score')}
      </label>
      <div className="flex items-center justify-between gap-1.5">
        {Array.from({ length: MOOD_SCORE_MAX - MOOD_SCORE_MIN + 1 }, (_, i) => i + MOOD_SCORE_MIN).map((score) => {
          const isSelected = value === score;
          const color = getScoreColor(score);

          return (
            <button
              key={score}
              type="button"
              onClick={() => handleSelect(score)}
              className="flex items-center justify-center rounded-full font-semibold transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              style={{
                width: isSelected ? 40 : 32,
                height: isSelected ? 40 : 32,
                backgroundColor: color,
                color: '#fff',
                opacity: isSelected ? 1 : 0.6,
                fontSize: isSelected ? 16 : 13,
                boxShadow: isSelected
                  ? `0 0 0 3px hsl(var(--background)), 0 0 0 5px ${color}`
                  : 'none',
              }}
              aria-label={`${score}`}
              aria-pressed={isSelected}
            >
              {score}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const MoodScorePicker = React.memo(MoodScorePickerComponent);
