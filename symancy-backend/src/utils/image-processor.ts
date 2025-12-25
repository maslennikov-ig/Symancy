/**
 * Image Processor Utility
 *
 * Download and resize images using Sharp
 * Per TZ: 800x800 max dimension, WebP format, quality 85
 */
import sharp from "sharp";
import {
  IMAGE_MAX_DIMENSION,
  IMAGE_FORMAT,
  IMAGE_QUALITY,
  RETRY_ATTEMPTS,
  RETRY_BASE_DELAY_MS,
  RETRY_MAX_DELAY_MS,
} from "../config/constants.js";
import { logger } from "../core/logger.js";

/**
 * Fetch with exponential backoff retry logic
 *
 * @param url - URL to fetch
 * @param retries - Number of retry attempts (default: RETRY_ATTEMPTS)
 * @returns Fetch response
 * @throws Error if all retries exhausted or 4xx error
 */
async function fetchWithRetry(url: string, retries: number = RETRY_ATTEMPTS): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      logger.debug("Fetching image", { url, attempt: attempt + 1, maxRetries: retries });

      const response = await fetch(url);

      // Don't retry on 4xx errors (client errors - invalid URL, not found, etc.)
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`Client error: ${response.status} ${response.statusText}`);
      }

      // Don't retry if response is ok
      if (response.ok) {
        return response;
      }

      // Retry on 5xx errors (server errors)
      lastError = new Error(`Server error: ${response.status} ${response.statusText}`);
      logger.warn("Server error, will retry", {
        url,
        status: response.status,
        attempt: attempt + 1,
        retriesLeft: retries - attempt - 1,
      });
    } catch (error) {
      // Network errors or other fetch failures
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry if it's a client error (4xx)
      if (lastError.message.includes("Client error")) {
        throw lastError;
      }

      logger.warn("Network error, will retry", {
        url,
        error: lastError.message,
        attempt: attempt + 1,
        retriesLeft: retries - attempt - 1,
      });
    }

    // Calculate exponential backoff delay: min(baseDelay * 2^attempt, maxDelay)
    if (attempt < retries - 1) {
      const delay = Math.min(RETRY_BASE_DELAY_MS * Math.pow(2, attempt), RETRY_MAX_DELAY_MS);
      logger.info("Retrying after delay", { url, delayMs: delay, attempt: attempt + 1 });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // All retries exhausted
  const errorMessage = `Failed to fetch after ${retries} attempts: ${lastError?.message || "Unknown error"}`;
  logger.error("All retry attempts exhausted", { url, retries });
  throw new Error(errorMessage);
}

/**
 * Download image from URL and resize to 800x800 max, WebP format
 *
 * @param url - Image URL to download
 * @returns Resized image buffer
 * @throws Error if download or processing fails
 */
export async function downloadAndResize(url: string): Promise<Buffer> {
  try {
    // SSRF Protection: Only allow HTTPS URLs from telegram.org domain
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch (error) {
      throw new Error("Invalid URL format");
    }

    if (parsedUrl.protocol !== "https:") {
      throw new Error("Only HTTPS URLs are allowed");
    }

    if (!parsedUrl.hostname.endsWith(".telegram.org")) {
      throw new Error("Only telegram.org URLs are allowed");
    }

    logger.debug("Downloading image", { url });

    const response = await fetchWithRetry(url);

    const buffer = Buffer.from(await response.arrayBuffer());
    logger.debug("Image downloaded, processing...", { sizeBytes: buffer.length });

    const processedBuffer = await sharp(buffer)
      .resize(IMAGE_MAX_DIMENSION, IMAGE_MAX_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: IMAGE_QUALITY })
      .toBuffer();

    logger.info("Image processed successfully", {
      originalSize: buffer.length,
      processedSize: processedBuffer.length,
      format: IMAGE_FORMAT,
    });

    return processedBuffer;
  } catch (error) {
    logger.error("Image processing failed", { error, url });
    throw error;
  }
}

/**
 * Convert buffer to base64 data URL for LLM
 *
 * @param buffer - Image buffer (WebP format)
 * @returns Base64 data URL string
 */
export function toBase64DataUrl(buffer: Buffer): string {
  const base64 = buffer.toString("base64");
  return `data:image/webp;base64,${base64}`;
}
