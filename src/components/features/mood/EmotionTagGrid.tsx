/**
 * EmotionTagGrid Component
 *
 * A responsive 3-column grid of emotion toggle pills.
 * Supports multi-select with haptic feedback.
 *
 * @module components/features/mood/EmotionTagGrid
 */
import React, { useCallback } from 'react';
import { useTelegramWebApp } from '../../../hooks/useTelegramWebApp';
import { EMOTIONS } from '../../../types/mood';
import type { EmotionTag } from '../../../types/mood';

interface EmotionTagGridProps {
  /** Currently selected emotion tags */
  selected: EmotionTag[];
  /** Callback when selection changes */
  onChange: (emotions: EmotionTag[]) => void;
  /** Translation function */
  t: (key: string) => string;
}

function EmotionTagGridComponent({ selected, onChange, t }: EmotionTagGridProps) {
  const { hapticFeedback } = useTelegramWebApp();

  const handleToggle = useCallback(
    (tag: EmotionTag) => {
      hapticFeedback.selection();
      if (selected.includes(tag)) {
        onChange(selected.filter((s) => s !== tag));
      } else {
        onChange([...selected, tag]);
      }
    },
    [selected, onChange, hapticFeedback],
  );

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-foreground">
        {t('mood.entry.emotions')}
      </label>
      <div className="grid grid-cols-3 gap-2">
        {EMOTIONS.map((emotion) => {
          const isSelected = selected.includes(emotion.id);

          return (
            <button
              key={emotion.id}
              type="button"
              onClick={() => handleToggle(emotion.id)}
              className={`
                flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium
                transition-colors duration-150 border
                focus:outline-none focus-visible:ring-2 focus-visible:ring-ring
                ${
                  isSelected
                    ? 'bg-primary/15 border-primary text-primary'
                    : 'bg-card border-border text-foreground'
                }
              `}
              aria-pressed={isSelected}
              role="switch"
              aria-label={t(emotion.labelKey)}
            >
              <span aria-hidden="true">{emotion.emoji}</span>
              <span className="truncate">{t(emotion.labelKey)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const EmotionTagGrid = React.memo(EmotionTagGridComponent);
