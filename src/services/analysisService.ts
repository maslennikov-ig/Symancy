import { supabase } from '../lib/supabaseClient';

/**
 * Represents a single section of the coffee cup analysis.
 */
export interface AnalysisSection {
  title: string;
  content: string;
}

/**
 * Represents the entire analysis response.
 */
export interface AnalysisResponse {
  intro: string;
  sections: AnalysisSection[];
}

export interface UserData {
  name?: string;
  age?: string;
  gender?: string;
  intent?: string;
}

/**
 * Calls the Supabase Edge Function to analyze the coffee cup image.
 *
 * @param imageData The base64-encoded image data (without data URL prefix).
 * @param mimeType The MIME type of the image.
 * @param userData User context (name, intent, etc.) for personalized analysis.
 * @param mode The analysis mode ('psychologist' or 'esoteric').
 * @param language The language for the analysis response.
 * @returns A promise that resolves to the analysis response.
 */
export const analyzeCoffeeCup = async (
  imageData: string,
  mimeType: string,
  userData: UserData,
  mode: 'psychologist' | 'esoteric' = 'psychologist',
  language: string = 'ru'
): Promise<AnalysisResponse> => {
  try {
    const { data, error } = await supabase.functions.invoke('analyze-coffee', {
      body: {
        image: imageData,
        mimeType,
        userData,
        mode,
        language,
      },
    });

    if (error) {
      console.error('Edge Function Error:', error);
      // Check for insufficient credits (402 response)
      if (error.message?.includes('INSUFFICIENT_CREDITS') ||
          error.message?.includes('Insufficient credits') ||
          (error as any).status === 402) {
        throw new Error('INSUFFICIENT_CREDITS');
      }
      throw new Error(error.message || 'Analysis service unavailable');
    }

    if (!data.success) {
        throw new Error(data.error || 'Analysis failed');
    }

    // Validate response structure
    const result = data.data;
    if (!result.intro || !Array.isArray(result.sections)) {
      console.error('Invalid response structure:', result);
      throw new Error('Invalid analysis response format');
    }

    return result as AnalysisResponse;

  } catch (error) {
    console.error('Failed to analyze coffee cup:', error);
    throw error; // Re-throw to be handled by the UI
  }
};