/**
 * Memory Extraction Chain
 * Extracts memorable facts from user messages using Qwen 2.5 72B
 */
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getEnv } from "../config/env.js";

// Model for extraction
const EXTRACTION_MODEL = "qwen/qwen-2.5-72b-instruct";

// Categories for memories
export const MemoryCategory = z.enum([
  "personal_info", // name, age, location
  "health",        // symptoms, conditions
  "preferences",   // likes, dislikes, communication style
  "events",        // upcoming events, appointments
  "interests",     // hobbies, topics of interest
  "work",          // job, projects
  "other"
]);

export type MemoryCategory = z.infer<typeof MemoryCategory>;

// Extracted memory fact
export const ExtractedMemory = z.object({
  content: z.string().describe("The extracted fact in a concise statement"),
  category: MemoryCategory,
});

export type ExtractedMemory = z.infer<typeof ExtractedMemory>;

// Extraction result
export const ExtractionResult = z.object({
  memories: z.array(ExtractedMemory),
  hasMemories: z.boolean(),
});

export type ExtractionResult = z.infer<typeof ExtractionResult>;

// System prompt for extraction
const EXTRACTION_SYSTEM_PROMPT = `You are a memory extraction assistant. Your task is to identify important facts about the user from their message.

Extract ONLY concrete, factual information that would be useful to remember long-term:
- Personal info: name, age, location, family
- Health: symptoms, conditions, medications
- Preferences: likes, dislikes, communication style
- Events: upcoming appointments, deadlines
- Interests: hobbies, favorite topics
- Work: job, projects, colleagues

Rules:
1. Extract only EXPLICIT facts, don't infer or assume
2. Keep each fact concise (1 sentence)
3. Use third person ("The user is...", "User prefers...")
4. Skip greetings, small talk, questions
5. If no memorable facts, return empty array

Respond in JSON format:
{
  "memories": [
    {"content": "fact text", "category": "category_name"}
  ],
  "hasMemories": true/false
}`;

/**
 * Create extraction model (singleton)
 */
function createExtractionModel(): ChatOpenAI {
  const env = getEnv();
  return new ChatOpenAI({
    model: EXTRACTION_MODEL,
    temperature: 0.1, // Low for consistent extraction
    maxTokens: 500,
    configuration: {
      apiKey: env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
    },
  });
}

/**
 * Extract memorable facts from user message
 */
export async function extractMemories(
  message: string
): Promise<ExtractionResult> {
  const model = createExtractionModel();

  const messages = [
    new SystemMessage(EXTRACTION_SYSTEM_PROMPT),
    new HumanMessage(`Extract memorable facts from this user message:\n\n"${message}"`),
  ];

  const response = await model.invoke(messages);
  const content = response.content as string;

  // Parse JSON response
  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { memories: [], hasMemories: false };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const result = ExtractionResult.parse(parsed);

    return result;
  } catch (error) {
    // If parsing fails, return empty
    console.error("Memory extraction parse error:", error);
    return { memories: [], hasMemories: false };
  }
}
