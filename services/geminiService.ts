
import { GoogleGenAI, Type } from "@google/genai";
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

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY is not defined in environment variables");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });
const model = 'gemini-2.5-flash';

const languageMap: Record<Lang, string> = {
  en: "English",
  ru: "Russian",
  zh: "Chinese",
};

// Define the schema for the expected JSON response from the Gemini API.
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


export const analyzeCoffeeCup = async (imageData: string, mimeType: string, focusArea: string, language: Lang): Promise<AnalysisResponse> => {
  try {
    const languageName = languageMap[language];
    const systemInstruction = `You are a wise and insightful psychologist who uses the ancient art of coffee ground reading for deep personality analysis. Your task is not to predict the future, but to help the person understand themselves better. Your response must be in ${languageName}.`;

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
        data: imageData,
        mimeType: mimeType,
      },
    };

    const textPart = {
      text: prompt,
    };

    const response = await ai.models.generateContent({
      model: model,
      contents: { parts: [imagePart, textPart] },
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error && error.message.includes('JSON')) {
        throw new Error("Failed to parse analysis from Gemini API. The response was not valid JSON.");
    }
    throw new Error("Failed to get analysis from Gemini API.");
  }
};
