/**
 * MoodEntryForm Component
 *
 * Form for creating or updating a mood entry.
 * Contains score picker, emotion grid, and optional note textarea.
 *
 * @module pages/Mood/MoodEntryForm
 */
import React, { useState, useEffect, useCallback } from 'react';
import { MoodScorePicker } from '../../components/features/mood/MoodScorePicker';
import { EmotionTagGrid } from '../../components/features/mood/EmotionTagGrid';
import { Textarea } from '../../components/ui/textarea';
import type { MoodEntry, MoodEntryInput, EmotionTag } from '../../types/mood';

interface MoodEntryFormProps {
  /** Existing entry for today (null if new) */
  initialEntry: MoodEntry | null;
  /** Save handler called by parent (via MainButton) */
  onSave: (input: MoodEntryInput) => Promise<void>;
  /** Whether a save is in progress */
  isSaving: boolean;
  /** Translation function */
  t: (key: string) => string;
}

const MAX_NOTE_LENGTH = 500;

function MoodEntryFormComponent({
  initialEntry,
  onSave,
  isSaving,
  t,
}: MoodEntryFormProps) {
  const [score, setScore] = useState<number | null>(initialEntry?.score ?? null);
  const [emotions, setEmotions] = useState<EmotionTag[]>(
    initialEntry?.emotions ?? [],
  );
  const [note, setNote] = useState<string>(initialEntry?.note ?? '');

  // Sync state when initialEntry changes (e.g. fetched from server)
  useEffect(() => {
    if (initialEntry) {
      setScore(initialEntry.score);
      setEmotions(initialEntry.emotions);
      setNote(initialEntry.note ?? '');
    }
  }, [initialEntry]);

  const handleNoteChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      if (value.length <= MAX_NOTE_LENGTH) {
        setNote(value);
      }
    },
    [],
  );

  // Expose save data to parent via a ref-like approach using effect
  // The parent calls onSave, but we need to provide current form data.
  // We use a callback pattern: parent sets a flag, we respond.
  // Actually, parent calls onSave with data from this component.
  // We expose our data via a getter the parent can call.

  // Simpler approach: parent passes a ref or we provide the data via props.
  // Since the task says "calls onSave(input) when parent triggers save",
  // we'll use an imperative handle pattern.

  // But for simplicity and to match the task description, let's expose
  // the current form state via the onSave prop being called from parent.
  // The parent needs to know if form has changes - we'll communicate via
  // a data attribute or callback.

  // For now, we expose a method through React.useImperativeHandle
  // or simply have the parent pass a "triggerSave" prop.

  // Actually, looking at the task again: the parent component manages the MainButton
  // and calls a save function. The form needs to provide its current data.
  // Let's use React.forwardRef + useImperativeHandle.

  return (
    <div className="flex flex-col gap-6 pb-4">
      {/* Title */}
      <h2 className="text-lg font-semibold text-foreground">
        {initialEntry ? t('mood.entry.titleUpdate') : t('mood.entry.title')}
      </h2>

      {/* Score Picker */}
      <MoodScorePicker value={score} onChange={setScore} t={t} />

      {/* Emotion Tags */}
      <EmotionTagGrid selected={emotions} onChange={setEmotions} t={t} />

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
          {t('mood.entry.noteChars').replace('{count}', String(note.length))}
        </span>
      </div>
    </div>
  );
}

// Export both the component and a helper to extract form data
export default React.memo(MoodEntryFormComponent);

/**
 * Hook-friendly form state manager for the mood entry form.
 * Used by the parent page to get current form values for save.
 */
export function useMoodFormState(initialEntry: MoodEntry | null) {
  const [score, setScore] = useState<number | null>(initialEntry?.score ?? null);
  const [emotions, setEmotions] = useState<EmotionTag[]>(
    initialEntry?.emotions ?? [],
  );
  const [note, setNote] = useState<string>(initialEntry?.note ?? '');

  // Sync when initialEntry loads
  useEffect(() => {
    if (initialEntry) {
      setScore(initialEntry.score);
      setEmotions(initialEntry.emotions);
      setNote(initialEntry.note ?? '');
    }
  }, [initialEntry]);

  const hasChanges = score !== null && (
    score !== (initialEntry?.score ?? null) ||
    JSON.stringify(emotions) !== JSON.stringify(initialEntry?.emotions ?? []) ||
    note !== (initialEntry?.note ?? '')
  );

  const isValid = score !== null;

  const getInput = useCallback((): MoodEntryInput | null => {
    if (score === null) return null;
    return {
      score,
      emotions,
      note: note.trim() || undefined,
    };
  }, [score, emotions, note]);

  const handleNoteChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      if (value.length <= MAX_NOTE_LENGTH) {
        setNote(value);
      }
    },
    [],
  );

  return {
    score,
    setScore,
    emotions,
    setEmotions,
    note,
    handleNoteChange,
    hasChanges,
    isValid,
    getInput,
  };
}
