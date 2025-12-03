/**
 * Coffee Cup Analysis Service
 *
 * Calls n8n webhook endpoint for AI-powered coffee ground analysis
 * using OpenRouter models through the flow8n.ru platform.
 */

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

// n8n webhook endpoint for coffee analysis
const N8N_WEBHOOK_URL = 'https://flow8n.ru/webhook/coffee-analyze';

/**
 * Calls the n8n webhook to analyze the coffee cup image.
 *
 * @param imageData The base64-encoded image data (without data URL prefix).
 * @param mimeType The MIME type of the image.
 * @param focusArea The area of life to focus the analysis on.
 * @param language The language for the analysis response.
 * @returns A promise that resolves to the analysis response.
 */
export const analyzeCoffeeCup = async (
  imageData: string,
  mimeType: string,
  focusArea: string,
  language: string
): Promise<AnalysisResponse> => {
  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageData,
        mimeType,
        focusArea,
        language,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Webhook error:', response.status, errorText);
      throw new Error(`Analysis failed: ${response.status}`);
    }

    const result = await response.json();

    // Validate response structure
    if (!result.intro || !Array.isArray(result.sections)) {
      console.error('Invalid response structure:', result);
      throw new Error('Invalid analysis response format');
    }

    return result as AnalysisResponse;

  } catch (error) {
    console.error('Failed to analyze coffee cup:', error);

    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Network error. Please check your connection.');
    }

    if (error instanceof Error) {
      throw new Error(`Failed to get analysis: ${error.message}`);
    }

    throw new Error('An unknown error occurred during analysis.');
  }
};
