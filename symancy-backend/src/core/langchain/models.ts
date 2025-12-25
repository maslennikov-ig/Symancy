/**
 * OpenRouter-backed ChatOpenAI models factory
 * Creates LangChain ChatOpenAI instances configured for OpenRouter API
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

/**
 * OpenRouter API base URL
 */
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

/**
 * Common ChatOpenAI configuration options
 */
interface ModelOptions {
  temperature?: number;
  maxRetries?: number;
  streaming?: boolean;
}

/**
 * Create ChatOpenAI instance with OpenRouter configuration
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
  } = options;

  return new ChatOpenAI({
    openAIApiKey: env.OPENROUTER_API_KEY,
    modelName,
    temperature,
    maxRetries,
    streaming,
    configuration: {
      baseURL: OPENROUTER_BASE_URL,
    },
  });
}

/**
 * Create Arina persona model
 * Used for Arina-style interpretations with warm, mystical tone
 */
export function createArinaModel(options?: ModelOptions): ChatOpenAI {
  return createChatOpenAIInstance(MODEL_ARINA, {
    ...options,
    temperature: options?.temperature ?? 0.8,
  });
}

/**
 * Create Cassandra persona model
 * Used for Cassandra-style interpretations with analytical, direct tone
 */
export function createCassandraModel(options?: ModelOptions): ChatOpenAI {
  return createChatOpenAIInstance(MODEL_CASSANDRA, {
    ...options,
    temperature: options?.temperature ?? 0.7,
  });
}

/**
 * Create general chat model
 * Used for conversational responses and follow-up questions
 */
export function createChatModel(options?: ModelOptions): ChatOpenAI {
  return createChatOpenAIInstance(MODEL_CHAT, options);
}

/**
 * Create vision analysis model
 * Used for analyzing images (coffee grounds, palms, tarot cards)
 */
export function createVisionModel(options?: ModelOptions): ChatOpenAI {
  return createChatOpenAIInstance(MODEL_VISION, {
    ...options,
    temperature: options?.temperature ?? 0.3,
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
