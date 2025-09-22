import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY is not defined in environment variables");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const model = 'gemini-2.5-flash';

export const analyzeCoffeeCup = async (imageData: string, mimeType: string, focusArea: string): Promise<string> => {
  try {
    const systemInstruction = `You are a wise and insightful psychologist who uses the ancient art of coffee ground reading for deep personality analysis. Your task is not to predict the future, but to help the person understand themselves better. Your response must be in Russian.`;

    let focusInstruction = '';
    switch (focusArea) {
      case 'Карьера':
        focusInstruction = 'When analyzing, focus on career, professional development, ambitions, and self-realization.';
        break;
      case 'Отношения':
        focusInstruction = 'When analyzing, focus on personal relationships, love, friendship, and interactions with loved ones.';
        break;
      default: // 'Общее самочувствие'
        focusInstruction = 'Conduct a comprehensive analysis covering the general emotional state, inner resources, and life balance.';
        break;
    }

    const structurePrompt = `Carefully study the provided image of the coffee grounds in the cup. Your analysis must include:
1.  **Key Symbols and Figures**: Describe what you see.
2.  **Psychological Interpretation**: Explain what these symbols might mean in the context of the chosen theme.
3.  **Conclusions and Recommendations**: Formulate gentle and supportive advice to help the person on their path.

Your response should be structured, profound, and written in a calm, therapeutic tone. Avoid categorical predictions. Instead, use metaphorical and suggestive language that encourages self-reflection. Format your response using Markdown for better readability: use headings, lists, and text emphasis.`;
    
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
      }
    });

    return response.text;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw new Error("Failed to get analysis from Gemini API.");
  }
};