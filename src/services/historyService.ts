import { supabase } from '../lib/supabaseClient';
import { AnalysisResponse } from './analysisService';

export interface HistoryItem {
  id: string;
  created_at: string;
  analysis: AnalysisResponse;
  focus_area: string;
}

// Assumes a table 'analysis_history' exists with columns:
// id (uuid, pk), user_id (uuid, fk to auth.users), created_at (timestamptz), 
// analysis (jsonb), focus_area (text).
// RLS is enabled: `auth.uid() = user_id` for SELECT, INSERT.

export const saveAnalysis = async (userId: string, analysis: AnalysisResponse, focusArea: string): Promise<void> => {
  const { error } = await supabase
    .from('analysis_history')
    // FIX: The variable is named `focusArea`, which needs to be mapped to the `focus_area` database column.
    .insert([{ user_id: userId, analysis, focus_area: focusArea }]);

  if (error) {
    // Log error but don't throw, as it's a non-critical feature.
    console.warn('Failed to save analysis history:', error.message);
  }
};

export const getHistory = async (): Promise<HistoryItem[]> => {
    // RLS will ensure this query only returns data for the logged-in user.
    const { data, error } = await supabase
        .from('analysis_history')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching analysis history:', error);
        throw new Error(error.message);
    }

    return (data as HistoryItem[]) || [];
};
