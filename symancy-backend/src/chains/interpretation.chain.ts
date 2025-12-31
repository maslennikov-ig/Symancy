/**
 * Interpretation Chain
 * Generates psychological interpretations of coffee ground analysis
 * Supports both Arina (warm, mystical) and Cassandra (direct, analytical) personas
 */
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createArinaModel, createCassandraModel } from "../core/langchain/models.js";
import type {
  InterpretationChainInput,
  InterpretationResult,
  VisionAnalysisResult,
} from "../types/langchain.js";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { getLogger } from "../core/logger.js";
import { selectRandomLens } from "../config/interpretation-matrix.js";
import { findMaxSimilarity } from "../utils/similarity.js";

const logger = getLogger().child({ module: "interpretation-chain" });

/**
 * Get project root directory
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

/**
 * Fallback interpretations when LLM fails
 * Provides graceful degradation for better UX
 */
const FALLBACK_INTERPRETATION_RU = `
☕ К сожалению, сейчас я не могу полностью интерпретировать образы в вашей чашке.

Однако помните: кофейная гуща всегда хранит ваши мечты и надежды.
Попробуйте снова через несколько минут, и я постараюсь раскрыть для вас послание судьбы.

✨ Ваша удача на вашей стороне.
`;

const FALLBACK_INTERPRETATION_EN = `
☕ Unfortunately, I cannot fully interpret the images in your cup right now.

However, remember: coffee grounds always hold your dreams and hopes.
Try again in a few minutes, and I will try to reveal destiny's message for you.

✨ Your luck is on your side.
`;

/**
 * Cached prompts (loaded once at module init)
 */
let arinaSystemPrompt: string | null = null;
let arinaInterpretationPrompt: string | null = null;
let cassandraSystemPrompt: string | null = null;
let cassandraInterpretationPrompt: string | null = null;

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
 * Load and cache Cassandra prompts from disk
 * Called once at module initialization
 */
async function loadCassandraPrompts(): Promise<void> {
  if (cassandraSystemPrompt && cassandraInterpretationPrompt) {
    return; // Already loaded
  }

  const systemPromptPath = path.join(
    projectRoot,
    "prompts/cassandra/system.txt"
  );
  const interpretationPromptPath = path.join(
    projectRoot,
    "prompts/cassandra/interpretation.txt"
  );

  [cassandraSystemPrompt, cassandraInterpretationPrompt] = await Promise.all([
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
 * @param input - Vision result, persona, and optional language/userName/userContext/recentInterpretations
 * @returns InterpretationResult with HTML-formatted text and token usage
 */
export async function generateInterpretation(
  input: InterpretationChainInput & {
    language?: string;
    userName?: string;
    userContext?: string;
    recentInterpretations?: string[];
  }
): Promise<InterpretationResult> {
  const {
    visionResult,
    persona,
    language = "ru",
    userName = "дорогой друг",
    userContext,
    recentInterpretations = [],
  } = input;

  // Validate persona
  if (persona !== "arina" && persona !== "cassandra") {
    throw new Error(
      `Persona "${persona}" is not supported. Available personas: "arina", "cassandra".`
    );
  }

  // Load prompts based on persona (cached after first call)
  let systemPrompt: string;
  let interpretationPrompt: string;
  let model;

  if (persona === "arina") {
    await loadArinaPrompts();

    if (!arinaSystemPrompt || !arinaInterpretationPrompt) {
      throw new Error("Failed to load Arina prompts");
    }

    systemPrompt = arinaSystemPrompt;
    interpretationPrompt = arinaInterpretationPrompt;
    model = await createArinaModel();
  } else {
    // Cassandra persona
    await loadCassandraPrompts();

    if (!cassandraSystemPrompt || !cassandraInterpretationPrompt) {
      throw new Error("Failed to load Cassandra prompts");
    }

    systemPrompt = cassandraSystemPrompt;
    interpretationPrompt = cassandraInterpretationPrompt;
    model = await createCassandraModel();
  }

  // Format vision result for prompt
  const formattedVisionResult = formatVisionResult(visionResult);

  // Select a random lens from the interpretation matrix
  const lens = selectRandomLens([], userContext);

  logger.info({ lensId: lens.id, lensName: lens.name }, "Selected interpretation lens");

  // Replace placeholders in interpretation prompt
  const interpretationText = replacePlaceholders(interpretationPrompt, {
    VISION_RESULT: formattedVisionResult,
    LANGUAGE: language,
    USER_NAME: userName,
    USER_CONTEXT: userContext || "Не указан",
    LENS_NAME: lens.name,
    LENS_INSTRUCTION: lens.instruction,
  });

  // Create messages for LangChain
  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(interpretationText),
  ];

  // Invoke model with error recovery
  try {
    const response = await model.invoke(messages);

    // Extract token usage from response metadata
    // ChatOpenAI response structure: response.usage_metadata.total_tokens or response.response_metadata
    const tokensUsed = response.usage_metadata?.total_tokens ?? 0;

    // Check similarity with recent interpretations
    if (recentInterpretations && recentInterpretations.length > 0) {
      const { maxSimilarity } = findMaxSimilarity(
        response.content as string,
        recentInterpretations
      );

      if (maxSimilarity > 0.35) {
        logger.info({ maxSimilarity }, "Interpretation too similar, re-rolling with different lens");

        // Select new lens avoiding the current one
        const newLens = selectRandomLens([lens.id], userContext);

        logger.info({ newLensId: newLens.id, newLensName: newLens.name }, "Re-rolled lens");

        // Regenerate with new lens
        const newInterpretationText = replacePlaceholders(interpretationPrompt, {
          VISION_RESULT: formattedVisionResult,
          LANGUAGE: language,
          USER_NAME: userName,
          USER_CONTEXT: userContext || "Не указан",
          LENS_NAME: newLens.name,
          LENS_INSTRUCTION: newLens.instruction,
        });

        const newMessages = [
          new SystemMessage(systemPrompt),
          new HumanMessage(newInterpretationText),
        ];

        const newResponse = await model.invoke(newMessages);

        return {
          text: newResponse.content as string,
          persona,
          tokensUsed:
            (response.usage_metadata?.total_tokens ?? 0) +
            (newResponse.usage_metadata?.total_tokens ?? 0),
          success: true,
        };
      }
    }

    return {
      text: response.content as string,
      persona,
      tokensUsed,
      success: true,
    };
  } catch (error) {
    logger.error({ error, persona, language }, "Interpretation chain failed, using fallback");

    // Select fallback based on language
    const fallback =
      language === "en" ? FALLBACK_INTERPRETATION_EN : FALLBACK_INTERPRETATION_RU;

    return {
      text: fallback,
      persona,
      tokensUsed: 0,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
