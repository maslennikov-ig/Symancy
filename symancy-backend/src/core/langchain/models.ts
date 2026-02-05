/**
 * OpenRouter-backed ChatOpenAI models factory
 * Creates LangChain ChatOpenAI instances configured for OpenRouter API
 *
 * Models are loaded from dynamic configuration (system_config table)
 * with fallback to constants for resilience.
 */
import { ChatOpenAI } from "@langchain/openai";
import { getEnv } from "../../config/env.js";
import {
  MODEL_ARINA,
  MODEL_CASSANDRA,
  MODEL_CHAT,
  MODEL_VISION,
  RETRY_ATTEMPTS,
} from "../../config/constants.js";
import { getConfig } from "../../modules/config/service.js";

/**
 * OpenRouter API base URL
 */
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

/**
 * Common ChatOpenAI configuration options
 * Extended with diversity parameters for interpretation variety
 */
interface ModelOptions {
  temperature?: number;
  maxRetries?: number;
  streaming?: boolean;
  /** Penalty for repeating same tokens (0-2, default 0) */
  frequencyPenalty?: number;
  /** Penalty for repeating same topics (0-2, default 0) */
  presencePenalty?: number;
  /** Maximum tokens in response */
  maxTokens?: number;
  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * Create ChatOpenAI instance with OpenRouter configuration
 * Uses the correct LangChain configuration pattern for OpenRouter
 */
function createChatOpenAIInstance(
  modelName: string,
  options: ModelOptions = {}
): ChatOpenAI {
  const env = getEnv();
  const {
    temperature = 0.7,
    maxRetries = RETRY_ATTEMPTS,
    streaming = false,
    frequencyPenalty,
    presencePenalty,
    maxTokens,
    timeout,
  } = options;

  // Build model kwargs for additional parameters
  const modelKwargs: Record<string, unknown> = {};
  if (frequencyPenalty !== undefined) {
    modelKwargs.frequency_penalty = frequencyPenalty;
  }
  if (presencePenalty !== undefined) {
    modelKwargs.presence_penalty = presencePenalty;
  }

  return new ChatOpenAI({
    model: modelName,
    temperature,
    maxRetries,
    streaming,
    maxTokens,
    timeout,
    modelKwargs: Object.keys(modelKwargs).length > 0 ? modelKwargs : undefined,
    configuration: {
      apiKey: env.OPENROUTER_API_KEY,
      baseURL: OPENROUTER_BASE_URL,
    },
  });
}

/**
 * Create Arina persona model
 * Used for Arina-style interpretations with warm, archetypal tone
 *
 * Loads model from per-persona config (arina_model, arina_temperature, arina_max_tokens)
 * with fallback to constants for resilience.
 *
 * Optimized parameters for interpretation variety:
 * - High temperature (0.9) for creative diversity
 * - Frequency penalty (0.6) to reduce token repetition
 * - Presence penalty (0.5) to encourage new topics
 * - Max tokens (3000) sufficient for both single topic and full "all" readings
 */
export async function createArinaModel(options?: ModelOptions): Promise<ChatOpenAI> {
  const modelName = await getConfig("arina_model", MODEL_ARINA);
  const temperature = await getConfig("arina_temperature", 0.9);
  const maxTokens = await getConfig("arina_max_tokens", 3000);
  const frequencyPenalty = await getConfig("arina_frequency_penalty", 0.6);
  const presencePenalty = await getConfig("arina_presence_penalty", 0.5);

  return createChatOpenAIInstance(modelName, {
    temperature,
    frequencyPenalty,
    presencePenalty,
    maxTokens,
    ...options,
  });
}

/**
 * Create Cassandra persona model
 * Used for Cassandra-style interpretations with mystical, creative tone
 *
 * Loads model from per-persona config with fallback to constants for resilience.
 *
 * Optimized parameters for creative mystical responses:
 * - Higher temperature (1.1) for more creative, unpredictable outputs
 * - Frequency penalty (0.4) to reduce token repetition
 * - Presence penalty (0.3) to encourage exploring new topics
 * - Max tokens (1500) for elaborate mystical descriptions
 */
export async function createCassandraModel(options?: ModelOptions): Promise<ChatOpenAI> {
  const modelName = await getConfig("cassandra_model", MODEL_CASSANDRA);
  const temperature = await getConfig("cassandra_temperature", 1.1);
  const maxTokens = await getConfig("cassandra_max_tokens", 1500);
  const frequencyPenalty = await getConfig("cassandra_frequency_penalty", 0.4);
  const presencePenalty = await getConfig("cassandra_presence_penalty", 0.3);

  return createChatOpenAIInstance(modelName, {
    temperature,
    frequencyPenalty,
    presencePenalty,
    maxTokens,
    ...options,
  });
}

/**
 * Create general chat model
 * Used for conversational responses and follow-up questions
 *
 * Loads model from dynamic config with fallback to constant.
 */
export async function createChatModel(options?: ModelOptions): Promise<ChatOpenAI> {
  const modelName = await getConfig("chat_model", MODEL_CHAT);

  return createChatOpenAIInstance(modelName, options);
}

/**
 * Create vision analysis model
 * Used for analyzing images (coffee grounds, palms, tarot cards)
 *
 * Loads model from dynamic config (vision_model) with fallback to constant.
 *
 * Optimized parameters for accurate pattern detection:
 * - Low temperature (0.3) for consistency
 * - Max tokens (800) for concise structured output
 */
export async function createVisionModel(options?: ModelOptions): Promise<ChatOpenAI> {
  const modelName = await getConfig("vision_model", MODEL_VISION);
  const temperature = await getConfig("vision_temperature", 0.3);
  const maxTokens = await getConfig("vision_max_tokens", 800);

  return createChatOpenAIInstance(modelName, {
    temperature,
    maxTokens,
    ...options,
  });
}

/**
 * Generic factory for creating model by name
 * Useful for dynamic model selection
 */
export function createModel(
  modelName: string,
  options?: ModelOptions
): ChatOpenAI {
  return createChatOpenAIInstance(modelName, options);
}
