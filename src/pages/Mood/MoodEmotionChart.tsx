import React, { useMemo } from 'react';
import { EMOTIONS } from '../../types/mood';
import type { MoodEntry, EmotionTag } from '../../types/mood';

interface MoodEmotionChartProps {
  entries: MoodEntry[];
  t: (key: string) => string;
}

interface EmotionCount {
  id: EmotionTag;
  emoji: string;
  labelKey: string;
  count: number;
}

const PRIMARY_COLOR = 'hsl(262, 83%, 58%)';
const MAX_DISPLAY = 6;

function MoodEmotionChartComponent({ entries, t }: MoodEmotionChartProps) {
  const emotionCounts = useMemo<EmotionCount[]>(() => {
    const counts = new Map<EmotionTag, number>();

    for (const entry of entries) {
      for (const emotion of entry.emotions) {
        counts.set(emotion, (counts.get(emotion) ?? 0) + 1);
      }
    }

    if (counts.size === 0) return [];

    const result: EmotionCount[] = [];
    for (const [id, count] of counts) {
      const def = EMOTIONS.find((e) => e.id === id);
      if (def) {
        result.push({
          id,
          emoji: def.emoji,
          labelKey: def.labelKey,
          count,
        });
      }
    }

    result.sort((a, b) => b.count - a.count);
    return result.slice(0, MAX_DISPLAY);
  }, [entries]);

  const maxCount = emotionCounts.length > 0 ? emotionCounts[0].count : 0;

  if (emotionCounts.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 text-center">
        <h3 className="text-sm font-semibold text-foreground mb-2">
          {t('mood.insights.emotionsTitle')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t('mood.insights.noData')}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3">
        {t('mood.insights.emotionsTitle')}
      </h3>

      <div className="flex flex-col gap-2.5">
        {emotionCounts.map((item, index) => {
          const widthPercent = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
          const opacity = 1 - index * 0.12;

          return (
            <div key={item.id} className="flex items-center gap-2">
              <span className="text-base w-6 text-center flex-shrink-0" aria-hidden="true">
                {item.emoji}
              </span>
              <span className="text-xs text-muted-foreground w-16 flex-shrink-0 truncate">
                {t(item.labelKey)}
              </span>
              <div className="flex-1 h-5 bg-muted/30 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(widthPercent, 8)}%`,
                    backgroundColor: PRIMARY_COLOR,
                    opacity,
                  }}
                />
              </div>
              <span className="text-xs font-medium text-foreground w-6 text-right flex-shrink-0">
                {item.count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const MoodEmotionChart = React.memo(MoodEmotionChartComponent);
