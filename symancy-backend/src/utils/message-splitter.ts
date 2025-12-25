/**
 * Message Splitter Utility
 *
 * HTML-aware message splitting for Telegram
 * Per TZ: 4096 character limit, use 4000 safe limit
 */
import { TELEGRAM_SAFE_LIMIT } from "../config/constants.js";
import { logger } from "../core/logger.js";

/**
 * Split long message into chunks that respect Telegram's 4096 limit
 * Tries to split at paragraph boundaries, then sentences, then words
 *
 * WARNING: This function is NOT HTML-aware. If your message contains HTML tags,
 * splitting may break tag boundaries. Consider:
 * 1. Keeping messages under TELEGRAM_SAFE_LIMIT when using HTML
 * 2. Using plain text for long content
 *
 * @param text - Plain text to split (no HTML recommended)
 * @param maxLength - Maximum length per chunk (default: TELEGRAM_SAFE_LIMIT)
 * @returns Array of message chunks
 */
export function splitMessage(text: string, maxLength = TELEGRAM_SAFE_LIMIT): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  logger.debug("Splitting long message", { length: text.length, maxLength });

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Try to find a good split point
    const splitIndex = findSplitPoint(remaining, maxLength);

    chunks.push(remaining.slice(0, splitIndex).trim());
    remaining = remaining.slice(splitIndex).trim();
  }

  logger.info("Message split into chunks", { totalChunks: chunks.length });
  return chunks;
}

/**
 * Find the best split point in text
 *
 * Priority:
 * 1. Paragraph boundary (\n\n)
 * 2. Line break (\n)
 * 3. Sentence boundary (. ! ?)
 * 4. Word boundary (space)
 * 5. Hard split at maxLength
 *
 * @param text - Text to find split point in
 * @param maxLength - Maximum length before split
 * @returns Index to split at
 */
function findSplitPoint(text: string, maxLength: number): number {
  // Try paragraph boundary
  const paragraphEnd = text.lastIndexOf("\n\n", maxLength);
  if (paragraphEnd > maxLength * 0.5) {
    return paragraphEnd + 2;
  }

  // Try line break
  const lineEnd = text.lastIndexOf("\n", maxLength);
  if (lineEnd > maxLength * 0.5) {
    return lineEnd + 1;
  }

  // Try sentence boundary
  const sentenceEnd = Math.max(
    text.lastIndexOf(". ", maxLength),
    text.lastIndexOf("! ", maxLength),
    text.lastIndexOf("? ", maxLength)
  );
  if (sentenceEnd > maxLength * 0.3) {
    return sentenceEnd + 2;
  }

  // Try word boundary
  const wordEnd = text.lastIndexOf(" ", maxLength);
  if (wordEnd > maxLength * 0.3) {
    return wordEnd + 1;
  }

  // Hard split at maxLength
  logger.warn("Using hard split (no good boundary found)", { maxLength });
  return maxLength;
}
