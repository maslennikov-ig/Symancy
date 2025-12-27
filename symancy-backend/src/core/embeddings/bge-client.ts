/**
 * BGE-M3 Embeddings Client
 * Uses OpenRouter API for Russian-optimized embeddings
 */
import OpenAI from "openai";
import { getEnv } from "../../config/env.js";
import { RETRY_ATTEMPTS, RETRY_BASE_DELAY_MS, RETRY_MAX_DELAY_MS } from "../../config/constants.js";

const EMBEDDING_MODEL = "baai/bge-m3";
const EMBEDDING_DIMS = 1024;

// OpenRouter client singleton
let client: OpenAI | null = null;

/**
 * Get or create OpenAI client configured for OpenRouter
 */
function getClient(): OpenAI {
  if (!client) {
    const env = getEnv();
    client = new OpenAI({
      apiKey: env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "https://symancy.ru",
        "X-Title": "Symancy Memory",
      },
      maxRetries: RETRY_ATTEMPTS,
      timeout: 60000, // 60 seconds
    });
  }
  return client;
}

/**
 * Sleep helper for retry logic
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
function getRetryDelay(attempt: number): number {
  const delay = Math.min(
    RETRY_BASE_DELAY_MS * Math.pow(2, attempt),
    RETRY_MAX_DELAY_MS
  );
  // Add jitter (±20%)
  const jitter = delay * 0.2 * (Math.random() - 0.5);
  return Math.floor(delay + jitter);
}

/**
 * Generate embedding for a single text with retry logic
 *
 * @param text - Text to embed
 * @returns Embedding vector (1024 dimensions)
 * @throws Error if all retry attempts fail
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const openai = getClient();

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    try {
      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: text,
        encoding_format: "float",
      });

      if (!response.data?.[0]?.embedding) {
        throw new Error("Empty embedding response from OpenRouter");
      }

      return response.data[0].embedding;
    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable
      const isRetryable = error instanceof OpenAI.APIError && (
        error.status === 429 || // Rate limit
        error.status === 500 || // Server error
        error.status === 503    // Service unavailable
      );

      if (!isRetryable || attempt === RETRY_ATTEMPTS - 1) {
        throw new Error(
          `Failed to generate embedding after ${attempt + 1} attempts: ${lastError.message}`
        );
      }

      // Wait before retry
      const delay = getRetryDelay(attempt);
      await sleep(delay);
    }
  }

  // This should never be reached, but TypeScript requires it
  throw new Error(`Failed to generate embedding: ${lastError?.message || "Unknown error"}`);
}

/**
 * Generate embeddings for multiple texts (batch) with retry logic
 *
 * @param texts - Array of texts to embed
 * @returns Array of embedding vectors (1024 dimensions each)
 * @throws Error if all retry attempts fail
 */
export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const openai = getClient();

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    try {
      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: texts,
        encoding_format: "float",
      });

      if (!response.data || response.data.length === 0) {
        throw new Error("Empty embeddings response from OpenRouter");
      }

      // Sort by index to ensure correct order
      const sorted = response.data
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
        .map(d => d.embedding);

      if (sorted.length !== texts.length) {
        throw new Error(
          `Embedding count mismatch: expected ${texts.length}, got ${sorted.length}`
        );
      }

      return sorted;
    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable
      const isRetryable = error instanceof OpenAI.APIError && (
        error.status === 429 || // Rate limit
        error.status === 500 || // Server error
        error.status === 503    // Service unavailable
      );

      if (!isRetryable || attempt === RETRY_ATTEMPTS - 1) {
        throw new Error(
          `Failed to generate embeddings after ${attempt + 1} attempts: ${lastError.message}`
        );
      }

      // Wait before retry
      const delay = getRetryDelay(attempt);
      await sleep(delay);
    }
  }

  // This should never be reached, but TypeScript requires it
  throw new Error(`Failed to generate embeddings: ${lastError?.message || "Unknown error"}`);
}

export { EMBEDDING_MODEL, EMBEDDING_DIMS };
