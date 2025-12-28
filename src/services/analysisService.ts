import { supabase } from '../lib/supabaseClient';
import { ErrorCodes, type ErrorCode } from '../constants/errorCodes';

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
 * Custom error class with error code
 */
export class AnalysisError extends Error {
  constructor(message: string, public code: ErrorCode) {
    super(message);
    this.name = 'AnalysisError';
  }
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

      // Check for error code in the response
      const errorCode = (error as any).code || (data as any)?.code;

      // Handle specific error codes
      if (errorCode) {
        throw new AnalysisError(error.message || 'Analysis failed', errorCode);
      }

      // Fallback: Check for insufficient credits (402 response)
      if (error.message?.includes('INSUFFICIENT_CREDITS') ||
          error.message?.includes('Insufficient credits') ||
          (error as any).status === 402) {
        throw new AnalysisError('Insufficient credits', ErrorCodes.INSUFFICIENT_CREDITS);
      }

      // Generic error
      throw new AnalysisError(
        error.message || 'Analysis service unavailable',
        ErrorCodes.INTERNAL_ERROR
      );
    }

    if (!data.success) {
      const errorCode = data.code || ErrorCodes.INTERNAL_ERROR;
      throw new AnalysisError(data.error || 'Analysis failed', errorCode);
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