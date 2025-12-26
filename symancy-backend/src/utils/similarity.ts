/**
 * Jaccard similarity utilities for diversity checking
 * Ensures AI interpretations don't repeat too similar content
 */

/**
 * Russian stop words to ignore in similarity calculations
 * These are common words that appear in every interpretation
 */
const STOP_WORDS_RU = new Set([
  // Pronouns
  "это", "что", "который", "такой", "весь", "сам", "свой",
  "твой", "твоя", "твое", "твои", "ваш", "ваша", "ваше",
  "этот", "эта", "эти", "тот", "того", "этого",
  // Linking verbs
  "быть", "было", "были", "будет", "есть", "являться",
  // Conjunctions and prepositions
  "как", "так", "для", "или", "если", "когда", "также",
  "через", "после", "перед", "между", "более", "менее",
  "может", "могут", "очень", "только", "уже", "еще",
  // Particles
  "бы", "же", "ли", "ни", "не", "вот", "даже",
  // Numerals
  "один", "одна", "одно", "два", "три",
  // Domain-specific words that appear in every interpretation
  "кофе", "чашка", "гуща", "узор", "образ", "символ",
  "видеть", "отражать", "говорить", "показывать",
  "твоей", "твоему", "твоего",
]);

/**
 * English stop words
 */
const STOP_WORDS_EN = new Set([
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "i",
  "it", "for", "not", "on", "with", "he", "as", "you", "do", "at",
  "this", "but", "his", "by", "from", "they", "we", "say", "her", "she",
  "or", "an", "will", "my", "one", "all", "would", "there", "their", "what",
  "so", "up", "out", "if", "about", "who", "get", "which", "go", "me",
  "when", "make", "can", "like", "time", "no", "just", "him", "know", "take",
  "people", "into", "year", "your", "good", "some", "could", "them", "see", "other",
  "than", "then", "now", "look", "only", "come", "its", "over", "think", "also",
  // Domain-specific
  "coffee", "cup", "grounds", "pattern", "symbol", "see", "reflect", "show",
]);

/**
 * Combined stop words (Russian + English)
 */
const STOP_WORDS = new Set([...STOP_WORDS_RU, ...STOP_WORDS_EN]);

/**
 * Extract significant words from text for similarity comparison
 * Removes HTML tags, stop words, and short words
 *
 * @param text - Input text (may contain HTML)
 * @returns Set of significant words
 */
function extractWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      // Remove HTML tags
      .replace(/<[^>]+>/g, " ")
      // Remove special characters but keep Cyrillic
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      // Split on whitespace
      .split(/\s+/)
      // Only words > 3 chars
      .filter(w => w.length > 3)
      // Remove stop words
      .filter(w => !STOP_WORDS.has(w))
  );
}

/**
 * Calculate Jaccard similarity coefficient between two texts
 * Jaccard = |A ∩ B| / |A ∪ B|
 *
 * @param text1 - First text
 * @param text2 - Second text
 * @returns Similarity score between 0 and 1
 *
 * @example
 * ```typescript
 * const similarity = jaccardSimilarity("hello world", "hello there");
 * console.log(similarity); // ~0.33
 * ```
 */
export function jaccardSimilarity(text1: string, text2: string): number {
  const words1 = extractWords(text1);
  const words2 = extractWords(text2);

  if (words1.size === 0 && words2.size === 0) {
    return 0;
  }

  // Calculate intersection
  const intersection = new Set([...words1].filter(w => words2.has(w)));

  // Calculate union
  const union = new Set([...words1, ...words2]);

  if (union.size === 0) return 0;

  return intersection.size / union.size;
}

/**
 * Check if new text is too similar to any text in history
 *
 * @param newText - New interpretation text
 * @param history - Array of recent interpretation texts
 * @param threshold - Similarity threshold (default 0.35 = 35%)
 * @returns true if similarity exceeds threshold with any history item
 *
 * @example
 * ```typescript
 * const history = ["Previous interpretation 1", "Previous interpretation 2"];
 * if (isTooSimilar(newInterpretation, history)) {
 *   // Re-roll with different archetype
 * }
 * ```
 */
export function isTooSimilar(
  newText: string,
  history: string[],
  threshold: number = 0.35
): boolean {
  for (const oldText of history) {
    const similarity = jaccardSimilarity(newText, oldText);
    if (similarity > threshold) {
      return true;
    }
  }
  return false;
}

/**
 * Find the most similar text in history and return its similarity score
 * Useful for debugging and logging
 *
 * @param newText - New interpretation text
 * @param history - Array of recent interpretation texts
 * @returns Object with maxSimilarity and index of most similar item
 */
export function findMaxSimilarity(
  newText: string,
  history: string[]
): { maxSimilarity: number; mostSimilarIndex: number } {
  let maxSimilarity = 0;
  let mostSimilarIndex = -1;

  for (let i = 0; i < history.length; i++) {
    const similarity = jaccardSimilarity(newText, history[i]!);
    if (similarity > maxSimilarity) {
      maxSimilarity = similarity;
      mostSimilarIndex = i;
    }
  }

  return { maxSimilarity, mostSimilarIndex };
}
