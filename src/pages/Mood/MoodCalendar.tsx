/**
 * MoodCalendar Component
 *
 * Monthly calendar view for mood diary entries.
 * Shows colored dots for days with entries and allows viewing details.
 *
 * @module pages/Mood/MoodCalendar
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getMoodHistory } from '../../services/moodService';
import { EMOTIONS } from '../../types/mood';
import { getScoreColor } from '../../lib/moodUtils';
import { createLogger } from '../../lib/logger';
import type { MoodEntry, EmotionTag } from '../../types/mood';
import type { Lang } from '../../lib/i18n';

const log = createLogger('MoodCalendar');

interface MoodCalendarProps {
  /** Current language for locale */
  language: Lang;
  /** Translation function */
  t: (key: string) => string;
}

/**
 * Get locale string for language code
 */
function getLocale(lang: Lang): string {
  const localeMap: Record<Lang, string> = {
    ru: 'ru-RU',
    en: 'en-US',
    zh: 'zh-CN',
  };
  return localeMap[lang] || 'en-US';
}

/**
 * Get days in a month
 */
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Get day of week for first day of month (0=Sun, 1=Mon, ...)
 * Adjusted for Monday-first week
 */
function getFirstDayOfMonth(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  // Convert Sunday=0 to Monday-first: Mon=0, Tue=1, ..., Sun=6
  return day === 0 ? 6 : day - 1;
}

function MoodCalendarComponent({ language, t }: MoodCalendarProps) {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const locale = getLocale(language);

  // Fetch entries for current month (with AbortController for cancellation)
  useEffect(() => {
    const controller = new AbortController();

    async function fetchEntries() {
      setIsLoading(true);
      setError(null);
      try {
        const startDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
        const endDay = getDaysInMonth(currentYear, currentMonth);
        const endDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

        const data = await getMoodHistory(startDate, endDate);
        if (!controller.signal.aborted) {
          setEntries(data);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        log.error('Failed to load mood history', err);
        setEntries([]);
        setError(t('mood.error.loadFailed'));
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    fetchEntries();
    return () => {
      controller.abort();
    };
  }, [currentYear, currentMonth]);

  // Create a map of date -> entry for quick lookup
  const entryMap = useMemo(() => {
    const map = new Map<string, MoodEntry>();
    for (const entry of entries) {
      map.set(entry.date, entry);
    }
    return map;
  }, [entries]);

  // Navigation handlers
  const handlePrevMonth = useCallback(() => {
    setSelectedDate(null);
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  }, [currentMonth]);

  const handleNextMonth = useCallback(() => {
    setSelectedDate(null);
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  }, [currentMonth]);

  // Generate localized day headers (Mon-Sun)
  const dayHeaders = useMemo(() => {
    const headers: string[] = [];
    // Start from Monday (Jan 6, 2025 is a Monday)
    for (let i = 0; i < 7; i++) {
      const date = new Date(2025, 0, 6 + i);
      headers.push(
        date.toLocaleDateString(locale, { weekday: 'short' }).slice(0, 2),
      );
    }
    return headers;
  }, [locale]);

  // Month name
  const monthName = useMemo(() => {
    const date = new Date(currentYear, currentMonth, 1);
    return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  }, [currentYear, currentMonth, locale]);

  // Calendar grid
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Selected entry detail
  const selectedEntry = selectedDate ? entryMap.get(selectedDate) ?? null : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={handlePrevMonth}
          className="p-2 rounded-lg text-foreground hover:bg-accent transition-colors"
          aria-label="Previous month"
          type="button"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h3 className="text-base font-semibold text-foreground capitalize">
          {monthName}
        </h3>
        <button
          onClick={handleNextMonth}
          className="p-2 rounded-lg text-foreground hover:bg-accent transition-colors"
          aria-label="Next month"
          type="button"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1">
        {dayHeaders.map((day, i) => (
          <div
            key={i}
            className="text-center text-xs font-medium text-muted-foreground py-1"
          >
            {day}
          </div>
        ))}

        {/* Empty cells before first day */}
        {Array.from({ length: firstDay }, (_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {/* Day cells */}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const dayNum = i + 1;
          const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
          const entry = entryMap.get(dateStr);
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;

          return (
            <button
              key={dayNum}
              type="button"
              onClick={() =>
                setSelectedDate(isSelected ? null : dateStr)
              }
              className={`
                relative flex flex-col items-center justify-center
                aspect-square rounded-lg text-sm transition-colors
                ${isToday ? 'ring-2 ring-primary' : ''}
                ${isSelected ? 'bg-accent' : 'hover:bg-accent/50'}
              `}
            >
              <span
                className={`
                  ${isToday ? 'font-bold text-primary' : 'text-foreground'}
                `}
              >
                {dayNum}
              </span>
              {entry && (
                <span
                  className="absolute bottom-1 w-2 h-2 rounded-full"
                  style={{ backgroundColor: getScoreColor(entry.score) }}
                  aria-label={`Score: ${entry.score}`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-destructive/10 text-destructive p-3 rounded-lg text-sm text-center">
          {error}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: 'hsl(0, 70%, 55%)' }}
          />
          {t('mood.calendar.legend.low')}
        </div>
        <div className="flex items-center gap-1">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: 'hsl(50, 80%, 50%)' }}
          />
        </div>
        <div className="flex items-center gap-1">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: 'hsl(120, 50%, 45%)' }}
          />
          {t('mood.calendar.legend.high')}
        </div>
      </div>

      {/* Selected day detail card */}
      {selectedDate && (
        <div className="bg-card border border-border rounded-xl p-4">
          {selectedEntry ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString(
                    locale,
                    { weekday: 'long', day: 'numeric', month: 'long' },
                  )}
                </span>
                <span
                  className="text-lg font-bold"
                  style={{ color: getScoreColor(selectedEntry.score) }}
                >
                  {selectedEntry.score}/10
                </span>
              </div>

              {selectedEntry.emotions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedEntry.emotions.map((tag: EmotionTag) => {
                    const emotion = EMOTIONS.find((e) => e.id === tag);
                    if (!emotion) return null;
                    return (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary"
                      >
                        <span aria-hidden="true">{emotion.emoji}</span>
                        {t(emotion.labelKey)}
                      </span>
                    );
                  })}
                </div>
              )}

              {selectedEntry.note && (
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedEntry.note}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">
              {t('mood.calendar.noEntry')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default React.memo(MoodCalendarComponent);
