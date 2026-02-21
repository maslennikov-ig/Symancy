/**
 * MoodPromptCard Component
 *
 * Home page card that prompts the user to log their mood.
 * Shows different content based on whether today's mood is already logged.
 *
 * Pattern: DailyInsightCard (gradient background card)
 *
 * @module components/features/mood/MoodPromptCard
 */
import React from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { cn } from '../../../lib/utils';
import { useMoodEntry } from '../../../hooks/useMoodEntry';
import { EMOTIONS } from '../../../types/mood';
import { getScoreColor } from '../../../lib/moodUtils';
import type { Lang } from '../../../lib/i18n';

interface MoodPromptCardProps {
  /** Translation function */
  t: (key: string) => string;
  /** Current language */
  language: Lang;
  /** Optional className */
  className?: string;
}

function MoodPromptCardComponent({ t, language, className }: MoodPromptCardProps) {
  const navigate = useNavigate();
  const { todayEntry, isLoading } = useMoodEntry();

  const handleNavigate = () => {
    if (todayEntry) {
      navigate('/mood?tab=calendar');
    } else {
      navigate('/mood');
    }
  };

  return (
    <Card
      className={cn('w-full overflow-hidden', className)}
      style={{
        background:
          'linear-gradient(135deg, #6366F1 0%, #8B5CF6 50%, #A78BFA 100%)',
      }}
    >
      <CardContent className="p-4">
        <div className="flex flex-col gap-3">
          {todayEntry ? (
            <>
              {/* Already logged state */}
              <div className="flex items-center gap-2">
                <span className="text-xl" aria-hidden="true">
                  {'\u{1F60A}'}
                </span>
                <h3 className="text-base font-semibold text-white">
                  {t('home.moodPrompt.logged')}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className="text-2xl font-bold text-white"
                  style={{ color: getScoreColor(todayEntry.score) }}
                >
                  {todayEntry.score}/10
                </span>
              </div>

              {/* Show emotion pills */}
              {todayEntry.emotions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {todayEntry.emotions.slice(0, 4).map((tag) => {
                    const emotion = EMOTIONS.find((e) => e.id === tag);
                    if (!emotion) return null;
                    return (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-white/20 text-white"
                      >
                        <span aria-hidden="true">{emotion.emoji}</span>
                        {t(emotion.labelKey)}
                      </span>
                    );
                  })}
                </div>
              )}

              <Button
                onClick={handleNavigate}
                variant="secondary"
                size="sm"
                className="self-start bg-white/20 hover:bg-white/30 text-white border-0"
              >
                {t('home.moodPrompt.viewDiary')}
              </Button>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-2 gap-4">
              {/* Not logged state */}
              <div className="flex flex-col items-center gap-1 text-center">
                <span className="text-4xl drop-shadow-md mb-2" aria-hidden="true" style={{ animation: 'pulse 3s infinite' }}>
                  {'\u{1F31C}'}
                </span>
                <h3 className="text-lg font-bold text-white tracking-tight drop-shadow-sm">
                  {t('home.moodPrompt')}
                </h3>
                <p className="text-sm font-medium text-white/90 px-4 mt-1">
                  {t('mood.entry.title')}
                </p>
              </div>

              <Button
                onClick={handleNavigate}
                variant="secondary"
                size="lg"
                className="w-full mt-2 font-bold shadow-lg text-indigo-700 bg-white hover:bg-white/90 hover:scale-[1.02] transition-all duration-300 active:scale-95 border-0"
              >
                <span className="text-xl mr-2">✨</span>
                {t('home.logMood')}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export const MoodPromptCard = React.memo(MoodPromptCardComponent);
