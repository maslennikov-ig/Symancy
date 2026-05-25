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
 * Machine-readable hint codes returned when a photo fails quality pre-check.
 * Frontend maps these to localized strings via quality.hints.* i18n keys.
 */
export type QualityHintCode =
  | 'too_dark'
  | 'too_bright'
  | 'blurry'
  | 'no_grounds'
  | 'cup_bottom_not_visible'
  | 'image_not_coffee'
  | 'too_much_liquid';

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
 * Thrown when the photo fails AI quality pre-check.
 * No credit is consumed in this case.
 */
export class QualityCheckError extends Error {
  public readonly code: typeof ErrorCodes.QUALITY_CHECK_FAILED;
  public readonly hints: QualityHintCode[];
  public readonly issues: string[];

  constructor(hints: QualityHintCode[], issues: string[]) {
    super('Photo quality check failed');
    this.name = 'QualityCheckError';
    this.code = ErrorCodes.QUALITY_CHECK_FAILED;
    this.hints = hints;
    this.issues = issues;
  }
}

/**
 * Calls the Supabase Edge Function to analyze the coffee cup image.
 *
 * The Edge Function runs an AI quality pre-check before consuming any credit.
 * If the photo is rejected, a QualityCheckError is thrown (no credit consumed).
 * If the photo passes, the credit is consumed and the analysis is returned.
 *
 * @param imageData The base64-encoded image data (without data URL prefix).
 * @param mimeType The MIME type of the image.
 * @param userData User context (name, intent, etc.) for personalized analysis.
 * @param mode The analysis mode ('psychologist' or 'esoteric').
 * @param language The language for the analysis response.
 * @returns A promise that resolves to the analysis response.
 * @throws QualityCheckError if photo is rejected (no credit consumed)
 * @throws AnalysisError for other errors
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

      // Check for error code in the response body
      const errorCode = (error as any).code || (data as any)?.code;

      // Quality check failed — no credit consumed
      if (
        errorCode === ErrorCodes.QUALITY_CHECK_FAILED ||
        (data as any)?.code === ErrorCodes.QUALITY_CHECK_FAILED
      ) {
        const hints: QualityHintCode[] = (data as any)?.hints ?? [];
        const issues: string[] = (data as any)?.issues ?? [];
        throw new QualityCheckError(hints, issues);
      }

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

    // Handle quality check failure returned as success:false (422 non-error path)
    if (!data.success && data.code === ErrorCodes.QUALITY_CHECK_FAILED) {
      const hints: QualityHintCode[] = data.hints ?? [];
      const issues: string[] = data.issues ?? [];
      throw new QualityCheckError(hints, issues);
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
