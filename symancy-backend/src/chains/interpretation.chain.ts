/**
 * Interpretation Chain
 * Generates warm, psychological interpretations of coffee ground analysis
 * Uses Arina persona with cached prompt templates
 */
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createArinaModel } from "../core/langchain/models.js";
import type {
  InterpretationChainInput,
  InterpretationResult,
  VisionAnalysisResult,
} from "../types/langchain.js";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Get project root directory
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

/**
 * Cached prompts (loaded once at module init)
 */
let arinaSystemPrompt: string | null = null;
let arinaInterpretationPrompt: string | null = null;

/**
 * Load and cache Arina prompts from disk
 * Called once at module initialization
 */
async function loadArinaPrompts(): Promise<void> {
  if (arinaSystemPrompt && arinaInterpretationPrompt) {
    return; // Already loaded
  }

  const systemPromptPath = path.join(
    projectRoot,
    "prompts/arina/system.txt"
  );
  const interpretationPromptPath = path.join(
    projectRoot,
    "prompts/arina/interpretation.txt"
  );

  [arinaSystemPrompt, arinaInterpretationPrompt] = await Promise.all([
    readFile(systemPromptPath, "utf-8"),
    readFile(interpretationPromptPath, "utf-8"),
  ]);
}

/**
 * Format vision result for prompt substitution
 * Combines raw description with structured patterns
 */
function formatVisionResult(visionResult: VisionAnalysisResult): string {
  const { rawDescription, symbols, colors, patterns } = visionResult;

  const parts: string[] = [rawDescription];

  if (symbols.length > 0) {
    parts.push(`\nSymbols detected: ${symbols.join(", ")}`);
  }

  if (colors.length > 0) {
    parts.push(`Colors observed: ${colors.join(", ")}`);
  }

  if (patterns.length > 0) {
    parts.push(`Patterns identified: ${patterns.join(", ")}`);
  }

  return parts.join("\n");
}

/**
 * Replace placeholders in interpretation prompt
 */
function replacePlaceholders(
  template: string,
  replacements: Record<string, string>
): string {
  let result = template;

  for (const [key, value] of Object.entries(replacements)) {
    const placeholder = `{{${key}}}`;
    result = result.replaceAll(placeholder, value);
  }

  return result;
}

/**
 * Generate interpretation of coffee ground analysis
 *
 * @param input - Vision result, persona, and optional language/userName
 * @returns InterpretationResult with HTML-formatted text and token usage
 */
export async function generateInterpretation(
  input: InterpretationChainInput & { language?: string; userName?: string }
): Promise<InterpretationResult> {
  const { visionResult, persona, language = "ru", userName = "дорогой друг" } = input;

  // Only Arina is supported for now (Cassandra will be added later)
  if (persona !== "arina") {
    throw new Error(
      `Persona "${persona}" is not yet supported. Only "arina" is currently available.`
    );
  }

  // Load prompts (cached after first call)
  await loadArinaPrompts();

  if (!arinaSystemPrompt || !arinaInterpretationPrompt) {
    throw new Error("Failed to load Arina prompts");
  }

  // Format vision result for prompt
  const formattedVisionResult = formatVisionResult(visionResult);

  // Replace placeholders in interpretation prompt
  const interpretationText = replacePlaceholders(arinaInterpretationPrompt, {
    VISION_RESULT: formattedVisionResult,
    LANGUAGE: language,
    USER_NAME: userName,
  });

  // Create messages for LangChain
  const messages = [
    new SystemMessage(arinaSystemPrompt),
    new HumanMessage(interpretationText),
  ];

  // Create Arina model and invoke
  const model = createArinaModel();
  const response = await model.invoke(messages);

  // Extract token usage from response metadata
  // ChatOpenAI response structure: response.usage_metadata.total_tokens or response.response_metadata
  const tokensUsed =
    response.usage_metadata?.total_tokens ??
    0;

  return {
    text: response.content as string,
    persona,
    tokensUsed,
  };
}
