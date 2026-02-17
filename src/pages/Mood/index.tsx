/**
 * Mood Diary Page
 *
 * Main page controller with two tabs: Entry and Calendar.
 * Integrates with Telegram MainButton for save and BackButton for navigation.
 *
 * @module pages/Mood
 */
import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useMainButton } from '../../hooks/useMainButton';
import { useBackButton } from '../../hooks/useBackButton';
import { useTelegramWebApp } from '../../hooks/useTelegramWebApp';
import { useMoodEntry } from '../../hooks/useMoodEntry';
import { getMoodHistory } from '../../services/moodService';
import { MoodScorePicker } from '../../components/features/mood/MoodScorePicker';
import { EmotionTagGrid } from '../../components/features/mood/EmotionTagGrid';
import { Textarea } from '../../components/ui/textarea';
import MoodCalendar from './MoodCalendar';
import MoodStats from './MoodStats';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import type { translations, Lang } from '../../lib/i18n';
import type { MoodEntry, MoodEntryInput, EmotionTag } from '../../types/mood';

interface MoodPageProps {
  /** Current language */
  language: Lang;
  /** Translation function */
  t: (key: keyof typeof translations.en) => string;
}

const MAX_NOTE_LENGTH = 500;

const MoodPage: React.FC<MoodPageProps> = ({ language, t: propT }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { hapticFeedback } = useTelegramWebApp();

  // Cast t for string key access
  const t = propT as (key: string) => string;

  // Tab state from URL param
  const initialTab = searchParams.get('tab') === 'calendar' ? 'calendar' : 'entry';
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  // Today's entry from hook
  const { todayEntry, save: saveEntry } = useMoodEntry();

  // Form state
  const [score, setScore] = useState<number | null>(null);
  const [emotions, setEmotions] = useState<EmotionTag[]>([]);
  const [note, setNote] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Calendar entries for stats
  const [calendarEntries, setCalendarEntries] = useState<MoodEntry[]>([]);

  // Initialize form from today's entry
  useEffect(() => {
    if (todayEntry) {
      setScore(todayEntry.score);
      setEmotions(todayEntry.emotions);
      setNote(todayEntry.note ?? '');
    }
  }, [todayEntry]);

  // Load calendar entries for stats
  useEffect(() => {
    async function loadEntries() {
      try {
        const now = new Date();
        const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        const endDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
        const data = await getMoodHistory(startDate, endDate);
        setCalendarEntries(data);
      } catch {
        // Stats are non-critical
      }
    }
    loadEntries();
  }, []);

  // Determine if form has changes
  const hasChanges = score !== null;

  // Note change handler
  const handleNoteChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      if (value.length <= MAX_NOTE_LENGTH) {
        setNote(value);
      }
    },
    [],
  );

  // Save handler
  const handleSave = useCallback(async () => {
    if (score === null) return;

    setIsSaving(true);
    try {
      const input: MoodEntryInput = {
        score,
        emotions,
        note: note.trim() || undefined,
      };

      await saveEntry(input);
      hapticFeedback.notification('success');
      setToastMessage(t('mood.saved'));

      // Auto-dismiss toast
      setTimeout(() => setToastMessage(null), 2500);
    } catch (err) {
      console.error('Failed to save mood:', err);
      hapticFeedback.notification('error');
      setToastMessage(t('mood.error.saveFailed'));
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setIsSaving(false);
    }
  }, [score, emotions, note, hapticFeedback, t, saveEntry]);

  // Back button -> navigate home
  const handleBack = useCallback(() => {
    navigate('/');
  }, [navigate]);

  useBackButton({
    visible: true,
    onClick: handleBack,
  });

  // MainButton for save (visible only on Entry tab with changes)
  useMainButton({
    text: todayEntry ? t('mood.update') : t('mood.save'),
    visible: activeTab === 'entry' && hasChanges && !isSaving,
    onClick: handleSave,
  });

  return (
    <div
      className="bg-background"
      style={{ minHeight: '100%' }}
    >
      {/* Header */}
      <header className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-bold text-foreground">
          {t('mood.title')}
        </h1>
      </header>

      {/* Tabs */}
      <div className="px-4">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="w-full">
            <TabsTrigger value="entry" className="flex-1">
              {t('mood.tab.entry')}
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex-1">
              {t('mood.tab.calendar')}
            </TabsTrigger>
          </TabsList>

          {/* Entry Tab */}
          <TabsContent value="entry">
            <div className="flex flex-col gap-6 pb-24 pt-2">
              {/* Title */}
              <h2 className="text-lg font-semibold text-foreground">
                {todayEntry
                  ? t('mood.entry.titleUpdate')
                  : t('mood.entry.title')}
              </h2>

              {/* Score Picker */}
              <MoodScorePicker value={score} onChange={setScore} t={t} />

              {/* Emotion Tags */}
              <EmotionTagGrid
                selected={emotions}
                onChange={setEmotions}
                t={t}
              />

              {/* Note */}
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="mood-note"
                  className="text-sm font-medium text-foreground"
                >
                  {t('mood.entry.note')}
                </label>
                <Textarea
                  id="mood-note"
                  value={note}
                  onChange={handleNoteChange}
                  maxLength={MAX_NOTE_LENGTH}
                  rows={3}
                  className="resize-none bg-card"
                  disabled={isSaving}
                />
                <span className="text-xs text-muted-foreground text-right">
                  {t('mood.entry.noteChars').replace(
                    '{count}',
                    String(note.length),
                  )}
                </span>
              </div>

              {/* Non-Telegram save button fallback */}
              <button
                type="button"
                onClick={handleSave}
                disabled={!hasChanges || isSaving}
                className={`
                  w-full py-3 rounded-xl text-sm font-semibold transition-colors
                  tg-webapp:hidden
                  ${
                    hasChanges && !isSaving
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'bg-muted text-muted-foreground cursor-not-allowed'
                  }
                `}
              >
                {isSaving
                  ? '...'
                  : todayEntry
                    ? t('mood.update')
                    : t('mood.save')}
              </button>
            </div>
          </TabsContent>

          {/* Calendar Tab */}
          <TabsContent value="calendar">
            <div className="flex flex-col gap-4 pb-24 pt-2">
              <MoodCalendar language={language} t={t} />
              <MoodStats entries={calendarEntries} t={t} />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Toast notification */}
      {toastMessage && (
        <div
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-foreground text-background px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium animate-in fade-in slide-in-from-bottom-4 duration-300"
          role="status"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default MoodPage;
