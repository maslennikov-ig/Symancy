import { supabase, createSupabaseWithToken } from '../lib/supabaseClient';
import { AnalysisResponse } from './analysisService';
import { getStoredToken } from './authService';

/**
 * UI-expected format for history items
 * This matches what HistoryDisplay, History page, and App.tsx expect
 */
export interface HistoryItem {
  id: string;
  created_at: string;
  analysis: AnalysisResponse;
  focus_area: string;
  /** Optional image URL for display */
  image_url?: string;
  /** Original persona (arina, cassandra, etc.) */
  persona?: string;
}

/**
 * Raw database format for analysis_history table
 */
interface DbHistoryItem {
  id: string;
  telegram_user_id: number;
  image_url: string | null;
  analysis_type: string;
  persona: string;
  interpretation: string | null;
  tokens_used: number | null;
  model_used: string | null;
  processing_time_ms: number | null;
  status: string;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
  unified_user_id: string | null;
  vision_model_used: string | null;
  vision_tokens_used: number | null;
}

/**
 * Map analysis_type to focus_area for UI display
 * Maps to valid FocusArea values: 'wellbeing' | 'career' | 'relationships'
 */
function mapAnalysisTypeToFocusArea(analysisType: string): string {
  const mapping: Record<string, string> = {
    basic: 'wellbeing',
    premium: 'wellbeing',
    cassandra: 'wellbeing',
    love: 'relationships',
    career: 'career',
    health: 'wellbeing',
    wealth: 'career',
    relationships: 'relationships',
    wellbeing: 'wellbeing',
  };
  return mapping[analysisType] || 'wellbeing';
}

/**
 * Transform database record to UI-expected format
 */
function transformDbToUi(dbItem: DbHistoryItem): HistoryItem {
  return {
    id: dbItem.id,
    created_at: dbItem.created_at,
    analysis: {
      intro: dbItem.interpretation || '',
      sections: [], // DB stores plain text, no sections
    },
    focus_area: mapAnalysisTypeToFocusArea(dbItem.analysis_type),
    image_url: dbItem.image_url || undefined,
    persona: dbItem.persona,
  };
}

// Note: saveAnalysis is not currently used - analyses are saved by the backend
// Keeping for potential future web-only flow
export const saveAnalysis = async (userId: string, analysis: AnalysisResponse, focusArea: string): Promise<void> => {
  const { error } = await supabase
    .from('analysis_history')
    .insert([{
      user_id: userId,
      interpretation: analysis.intro,
      analysis_type: focusArea,
      persona: 'arina',
      status: 'completed'
    }]);

  if (error) {
    console.warn('Failed to save analysis history:', error.message);
  }
};

export const getHistory = async (): Promise<HistoryItem[]> => {
    // Check for Telegram JWT token first
    const telegramToken = getStoredToken();

    // Use appropriate client based on auth type
    const client = telegramToken
        ? createSupabaseWithToken(telegramToken)
        : supabase;

    // RLS will ensure this query only returns data for the logged-in user.
    // For Telegram users: RLS uses telegram_user_id from JWT claims
    // For Supabase Auth users: RLS uses auth.uid()
    const { data, error } = await client
        .from('analysis_history')
        .select('id, telegram_user_id, image_url, analysis_type, persona, interpretation, status, created_at, completed_at, unified_user_id')
        .eq('status', 'completed') // Only show completed analyses
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching analysis history:', error);
        throw new Error(error.message);
    }

    // Transform database format to UI format
    const dbItems = (data || []) as DbHistoryItem[];
    return dbItems.map(transformDbToUi);
};
