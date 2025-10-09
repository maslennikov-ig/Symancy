import { GoogleGenAI, Type } from '@google/genai';

/**
 * Represents a single section of the coffee cup analysis.
 */
export interface AnalysisSection {
  title: string;
  content: string;
}

/**
 * Represents the entire analysis response from the Gemini service.
 */
export interface AnalysisResponse {
  intro: string;
  sections: AnalysisSection[];
}

// Ensure the API_KEY is available as an environment variable
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    intro: {
      type: Type.STRING,
      description: "An introductory paragraph for the analysis, formatted in Markdown.",
    },
    sections: {
      type: Type.ARRAY,
      description: "An array of analysis sections.",
      items: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: "The title of the section (e.g., 'Key Symbols and Figures').",
          },
          content: {
            type: Type.STRING,
            description: "The detailed content of the section, formatted in Markdown.",
          },
        },
        required: ["title", "content"],
      },
    },
  },
  required: ["intro", "sections"],
};

const languageMap: Record<string, string> = {
  en: "English",
  ru: "Russian",
  zh: "Chinese",
};

/**
 * Calls the Gemini API directly from the client to analyze the coffee cup image.
 *
 * @param imageData The base64-encoded image data.
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
    const languageName = languageMap[language] || "English";
    const systemInstructionText = `You are a wise and insightful psychologist who uses the ancient art of coffee ground reading for deep personality analysis. Your task is not to predict the future, but to help the person understand themselves better. Your response must be in ${languageName}.`;

    let focusInstruction = '';
    switch (focusArea) {
      case 'career':
        focusInstruction = 'When analyzing, focus on career, professional development, ambitions, and self-realization.';
        break;
      case 'relationships':
        focusInstruction = 'When analyzing, focus on personal relationships, love, friendship, and interactions with loved ones.';
        break;
      default: // 'wellbeing'
        focusInstruction = 'Conduct a comprehensive analysis covering the general emotional state, inner resources, and life balance.';
        break;
    }

    const structurePrompt = `Carefully study the provided image of the coffee grounds in the cup. Your analysis must be returned as a JSON object matching the provided schema. The JSON object should contain:
1.  **intro**: An introductory paragraph.
2.  **sections**: An array of objects, each with 'title' and 'content'.
    - The first section should be titled 'Key Symbols and Figures' and describe what you see.
    - The second should be 'Psychological Interpretation' and explain what these symbols might mean.
    - The third should be 'Conclusions and Recommendations' with gentle, supportive advice.

The content for 'intro' and 'content' fields should be formatted using Markdown for better readability (headings, lists, emphasis). Your response should be profound and written in a calm, therapeutic tone. Avoid categorical predictions. Instead, use metaphorical and suggestive language that encourages self-reflection.`;
    
    const prompt = `${focusInstruction}\n\n${structurePrompt}`;
    
    const imagePart = {
      inlineData: {
        mimeType: mimeType,
        data: imageData,
      },
    };

    const textPart = { text: prompt };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart, textPart] },
      config: {
        systemInstruction: systemInstructionText,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    const jsonText = response.text.trim();
    if (!jsonText) {
      throw new Error("Received an empty response from the API.");
    }
    
    return JSON.parse(jsonText);

  } catch (error) {
    console.error('Failed to analyze coffee cup:', error);
    if (error instanceof Error) {
        if (error.message.includes('SAFETY')) {
             throw new Error('Analysis was blocked for safety reasons. Please try a different image.');
        }
        throw new Error(`Failed to get analysis: ${error.message}`);
    }
    throw new Error('An unknown error occurred during analysis.');
  }
};