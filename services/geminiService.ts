import { Lang } from "../lib/i18n";

// Define the structured response format
export interface AnalysisSection {
  title: string;
  content: string;
}

export interface AnalysisResponse {
  intro: string;
  sections: AnalysisSection[];
}

export const analyzeCoffeeCup = async (imageData: string, mimeType: string, focusArea: string, language: Lang): Promise<AnalysisResponse> => {
  try {
    const response = await fetch('/.netlify/functions/analyze', {
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
      console.error("Error from analysis function:", errorText);
      throw new Error(`Failed to get analysis. Server responded with ${response.status}.`);
    }

    const result: AnalysisResponse = await response.json();
    return result;

  } catch (error) {
    console.error("Error calling analysis function:", error);
    if (error instanceof Error && error.message.includes('JSON')) {
        throw new Error("Failed to parse analysis from the server. The response was not valid JSON.");
    }
    throw new Error("Failed to get analysis from the server.");
  }
};
