// types/mood.ts
// TypeScript types for Mood Diary feature (sym-243)

/** Valid emotion tag identifiers */
export type EmotionTag =
  | 'happy' | 'calm' | 'grateful' | 'energetic' | 'loved' | 'hopeful'
  | 'anxious' | 'sad' | 'angry' | 'tired' | 'stressed' | 'lonely';

/** Emotion definition with emoji and i18n label key */
export interface EmotionDefinition {
  id: EmotionTag;
  emoji: string;
  labelKey: string; // i18n key e.g., 'mood.emotion.happy'
}

/** Mood entry as stored in the database */
export interface MoodEntry {
  id: string;
  unified_user_id: string;
  date: string;           // YYYY-MM-DD
  score: number;          // 1-10
  emotions: EmotionTag[];
  note: string | null;
  source: 'telegram' | 'web' | 'mini_app';
  created_at: string;
  updated_at: string;
}

/** Input for creating/updating a mood entry */
export interface MoodEntryInput {
  score: number;
  emotions: EmotionTag[];
  note?: string;
}

/** The list of all emotion definitions */
export const EMOTIONS: EmotionDefinition[] = [
  { id: 'happy', emoji: '\u{1F60A}', labelKey: 'mood.emotion.happy' },
  { id: 'calm', emoji: '\u{1F60C}', labelKey: 'mood.emotion.calm' },
  { id: 'grateful', emoji: '\u{1F64F}', labelKey: 'mood.emotion.grateful' },
  { id: 'energetic', emoji: '\u26A1', labelKey: 'mood.emotion.energetic' },
  { id: 'loved', emoji: '\u2764\uFE0F', labelKey: 'mood.emotion.loved' },
  { id: 'hopeful', emoji: '\u{1F308}', labelKey: 'mood.emotion.hopeful' },
  { id: 'anxious', emoji: '\u{1F630}', labelKey: 'mood.emotion.anxious' },
  { id: 'sad', emoji: '\u{1F614}', labelKey: 'mood.emotion.sad' },
  { id: 'angry', emoji: '\u{1F620}', labelKey: 'mood.emotion.angry' },
  { id: 'tired', emoji: '\u{1F629}', labelKey: 'mood.emotion.tired' },
  { id: 'stressed', emoji: '\u{1F92F}', labelKey: 'mood.emotion.stressed' },
  { id: 'lonely', emoji: '\u{1F9D1}', labelKey: 'mood.emotion.lonely' },
];
