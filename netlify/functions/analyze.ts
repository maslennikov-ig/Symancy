import type { Handler } from "@netlify/functions";

// This file is a self-contained Netlify function that uses the Gemini REST API via fetch.
// It avoids needing the @google/genai SDK and a package.json, simplifying deployment.

// Define the schema for the expected JSON response.
// This matches the REST API's schema format.
const responseSchema = {
  type: 'OBJECT',
  properties: {
    intro: {
      type: 'STRING',
      description: "An introductory paragraph for the analysis, formatted in Markdown.",
    },
    sections: {
      type: 'ARRAY',
      description: "An array of analysis sections.",
      items: {
        type: 'OBJECT',
        properties: {
          title: {
            type: 'STRING',
            description: "The title of the section (e.g., 'Key Symbols and Figures').",
          },
          content: {
            type: 'STRING',
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


const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const API_KEY = process.env.API_KEY;
  if (!API_KEY) {
    console.error('API_KEY environment variable not set.');
    return { statusCode: 500, body: JSON.stringify({ error: 'API key is not configured.' }) };
  }

  try {
    const { imageData, mimeType, focusArea, language } = JSON.parse(event.body || '{}');

    if (!imageData || !mimeType || !focusArea || !language) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing required parameters.' }) };
    }

    const languageName = languageMap[language] || "English";
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

    const requestBody = {
      contents: [
        {
          parts: [
            { inline_data: { mime_type: mimeType, data: imageData } },
            { text: prompt },
          ],
        },
      ],
      system_instruction: {
          parts: [ { text: systemInstruction } ]
      },
      generation_config: {
        response_mime_type: "application/json",
        response_schema: responseSchema,
      },
    };

    const model = 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
    
    const geminiResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!geminiResponse.ok) {
        const errorBody = await geminiResponse.text();
        console.error("Gemini API Error:", errorBody);
        return { statusCode: geminiResponse.status, body: JSON.stringify({ error: `Gemini API error: ${errorBody}` }) };
    }

    const data = await geminiResponse.json();
    const analysisText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!analysisText) {
        console.error("Invalid response structure from Gemini API:", JSON.stringify(data, null, 2));
        return { statusCode: 500, body: JSON.stringify({ error: 'Could not find analysis text in Gemini response.' }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: analysisText, // The text itself is a JSON string, which the client will parse.
    };

  } catch (error) {
    console.error('Error in Netlify function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'An unknown error occurred.' }),
    };
  }
};

export { handler };
