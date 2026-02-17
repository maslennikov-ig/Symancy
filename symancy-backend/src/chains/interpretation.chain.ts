/**
 * Interpretation Chain
 * Generates psychological interpretations of coffee ground analysis
 * Supports both Arina (warm, mystical) and Cassandra (direct, analytical) personas
 */
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createArinaModel, createArinaBasicModel, createCassandraModel } from "../core/langchain/models.js";
import type {
  InterpretationChainInput,
  InterpretationResult,
  VisionAnalysisResult,
} from "../types/langchain.js";
import { readFile } from "fs/promises";
import path from "path";
import { getLogger } from "../core/logger.js";
import { selectRandomLens } from "../config/interpretation-matrix.js";
import { findMaxSimilarity } from "../utils/similarity.js";
import { getTopicFocusInstruction, type ReadingTopic } from "../config/constants.js";

const logger = getLogger().child({ module: "interpretation-chain" });

/** Max tokens for "all" topic readings (6 sections + intro + conclusion) */
const MAX_TOKENS_ALL_TOPICS = 5000;

/** Max tokens for continuation requests */
const MAX_TOKENS_CONTINUATION = 2000;

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

const FALLBACK_INTERPRETATION_ZH = `
☕ 很抱歉，我现在无法完全解读您杯中的图像。

但请记住：咖啡渣总是承载着您的梦想和希望。
请几分钟后再试一次，我会努力为您揭示命运的讯息。

✨ 好运与您同在。
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

  // Use process.cwd() to resolve from working directory (symlink-safe)
  const systemPromptPath = path.join(
    process.cwd(),
    "prompts/arina/system.txt"
  );
  const interpretationPromptPath = path.join(
    process.cwd(),
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

  // Use process.cwd() to resolve from working directory (symlink-safe)
  const systemPromptPath = path.join(
    process.cwd(),
    "prompts/cassandra/system.txt"
  );
  const interpretationPromptPath = path.join(
    process.cwd(),
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
 * Check if an LLM response was truncated due to token limit
 * and attempt a continuation if so.
 *
 * @param response - The LLM response to check
 * @param systemPrompt - The system prompt to reuse for continuation
 * @param model - The model instance (or a new one with continuation token limit)
 * @param topic - The reading topic for logging
 * @param createModelFn - Factory to create a continuation model with MAX_TOKENS_CONTINUATION
 * @returns The (potentially extended) text and additional tokens used
 */
async function handleTruncation(
  response: { content: string | object; response_metadata?: Record<string, unknown>; usage_metadata?: { total_tokens?: number } },
  systemPrompt: string,
  topic: ReadingTopic,
  createModelFn: () => Promise<import("@langchain/openai").ChatOpenAI>,
): Promise<{ text: string; additionalTokens: number }> {
  const text = response.content as string;
  const finishReason = response.response_metadata?.finish_reason as string | undefined;
  const tokensUsed = response.usage_metadata?.total_tokens ?? 0;

  if (finishReason !== "length") {
    return { text, additionalTokens: 0 };
  }

  logger.warn(
    { topic, tokensUsed, textLength: text.length, finishReason },
    "Interpretation truncated - requesting continuation"
  );

  try {
    const continuationModel = await createModelFn();

    const continuationMessages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(
        "Continue your response from where it was cut off. Complete the remaining sections naturally. Here is what you wrote so far:\n\n" + text
      ),
    ];

    const continuationResponse = await continuationModel.invoke(continuationMessages);
    const continuationText = continuationResponse.content as string;
    const continuationTokens = continuationResponse.usage_metadata?.total_tokens ?? 0;
    const continuationFinishReason = continuationResponse.response_metadata?.finish_reason as string | undefined;

    if (continuationFinishReason === "length") {
      logger.warn(
        { topic, continuationTokens, continuationLength: continuationText.length },
        "Continuation also truncated - returning combined result as-is"
      );
    }

    logger.info(
      { topic, continuationTokens, continuationLength: continuationText.length },
      "Continuation completed successfully"
    );

    return {
      text: text + "\n\n" + continuationText,
      additionalTokens: continuationTokens,
    };
  } catch (error) {
    logger.error(
      { error, topic },
      "Continuation request failed - returning truncated result"
    );
    return { text, additionalTokens: 0 };
  }
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
    /** Reading topic for focused analysis */
    topic?: ReadingTopic;
  }
): Promise<InterpretationResult> {
  const {
    visionResult,
    persona,
    language = "ru",
    userName = "дорогой друг",
    userContext,
    recentInterpretations = [],
    topic = "all",
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

  // Use higher maxTokens for "all" topic readings (covers 6 life areas)
  const isAllTopics = topic === "all";
  const maxTokensOverride = isAllTopics ? { maxTokens: MAX_TOKENS_ALL_TOPICS } : undefined;

  if (persona === "arina") {
    await loadArinaPrompts();

    if (!arinaSystemPrompt || !arinaInterpretationPrompt) {
      throw new Error("Failed to load Arina prompts");
    }

    systemPrompt = arinaSystemPrompt;
    interpretationPrompt = arinaInterpretationPrompt;

    // Single topic uses cheaper basic model; "all" topics uses full Arina model
    model = isAllTopics
      ? await createArinaModel(maxTokensOverride)
      : await createArinaBasicModel();
  } else {
    // Cassandra persona
    await loadCassandraPrompts();

    if (!cassandraSystemPrompt || !cassandraInterpretationPrompt) {
      throw new Error("Failed to load Cassandra prompts");
    }

    systemPrompt = cassandraSystemPrompt;
    interpretationPrompt = cassandraInterpretationPrompt;
    model = await createCassandraModel(maxTokensOverride);
  }

  // Format vision result for prompt
  const formattedVisionResult = formatVisionResult(visionResult);

  // Select a random lens from the interpretation matrix
  const lens = selectRandomLens([], userContext);

  logger.info({ lensId: lens.id, lensName: lens.name, topic }, "Selected interpretation lens");

  // Get topic focus instruction
  const topicFocus = getTopicFocusInstruction(topic, language);
  logger.debug({ topic, language, topicFocusLength: topicFocus.length }, "Topic focus instruction retrieved");

  // Replace placeholders in interpretation prompt
  const interpretationText = replacePlaceholders(interpretationPrompt, {
    VISION_RESULT: formattedVisionResult,
    LANGUAGE: language,
    USER_NAME: userName,
    USER_CONTEXT: userContext || "Не указан",
    LENS_NAME: lens.name,
    LENS_INSTRUCTION: lens.instruction,
    TOPIC_FOCUS: topicFocus,
  });

  // Create messages for LangChain
  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(interpretationText),
  ];

  // Factory for creating continuation model with limited tokens
  const createContinuationModel = async () => {
    const continuationOptions = { maxTokens: MAX_TOKENS_CONTINUATION };
    if (persona === "arina") {
      return isAllTopics
        ? createArinaModel(continuationOptions)
        : createArinaBasicModel(continuationOptions);
    }
    return createCassandraModel(continuationOptions);
  };

  // Invoke model with error recovery
  try {
    const response = await model.invoke(messages);

    // Extract token usage from response metadata
    // ChatOpenAI response structure: response.usage_metadata.total_tokens or response.response_metadata
    const tokensUsed = response.usage_metadata?.total_tokens ?? 0;

    // Check for truncation and attempt continuation if needed
    const { text: resolvedText, additionalTokens } = await handleTruncation(
      response,
      systemPrompt,
      topic,
      createContinuationModel,
    );

    // Check similarity with recent interpretations
    if (recentInterpretations && recentInterpretations.length > 0) {
      const { maxSimilarity } = findMaxSimilarity(
        resolvedText,
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
          TOPIC_FOCUS: topicFocus,
        });

        const newMessages = [
          new SystemMessage(systemPrompt),
          new HumanMessage(newInterpretationText),
        ];

        const newResponse = await model.invoke(newMessages);

        // Check for truncation on re-roll response as well
        const { text: rerollText, additionalTokens: rerollAdditionalTokens } = await handleTruncation(
          newResponse,
          systemPrompt,
          topic,
          createContinuationModel,
        );

        return {
          text: rerollText,
          persona,
          tokensUsed:
            tokensUsed +
            additionalTokens +
            (newResponse.usage_metadata?.total_tokens ?? 0) +
            rerollAdditionalTokens,
          success: true,
        };
      }
    }

    return {
      text: resolvedText,
      persona,
      tokensUsed: tokensUsed + additionalTokens,
      success: true,
    };
  } catch (error) {
    logger.error({ error, persona, language }, "Interpretation chain failed, using fallback");

    // Select fallback based on language
    const fallback =
      language === "zh" ? FALLBACK_INTERPRETATION_ZH :
      language === "en" ? FALLBACK_INTERPRETATION_EN :
      FALLBACK_INTERPRETATION_RU;

    return {
      text: fallback,
      persona,
      tokensUsed: 0,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
