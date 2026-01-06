/**
 * Memory Service
 * Handles storage and retrieval of user memories with vector search
 */
import { getSupabase } from "../core/database.js";
import { getEmbedding } from "../core/embeddings/index.js";
import { getLogger } from "../core/logger.js";

/**
 * Memory categories for classification
 */
export type MemoryCategory =
  | "personal_info"
  | "health"
  | "preferences"
  | "events"
  | "interests"
  | "work"
  | "other";

/**
 * User memory interface
 */
export interface UserMemory {
  id: string;
  telegramUserId: number;
  content: string;
  category: MemoryCategory;
  sourceMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Memory search result with similarity score
 */
export interface MemorySearchResult {
  id: string;
  content: string;
  category: string;
  score: number;
}

/**
 * Add a new memory for user
 *
 * @param telegramUserId - Telegram user ID
 * @param content - Memory content text
 * @param category - Memory category
 * @param sourceMessage - Optional source message text
 * @returns Created memory record
 * @throws Error if embedding generation or database insert fails
 */
export async function addMemory(
  telegramUserId: number,
  content: string,
  category: MemoryCategory,
  sourceMessage?: string
): Promise<UserMemory> {
  const supabase = getSupabase();

  // Generate embedding for semantic search
  const embedding = await getEmbedding(content);

  // Insert with embedding as JSON array (pgvector accepts this format)
  const { data, error } = await supabase
    .from("user_memories")
    .insert({
      telegram_user_id: telegramUserId,
      content,
      category,
      embedding: JSON.stringify(embedding),
      source_message: sourceMessage,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add memory: ${error.message}`);
  }

  return {
    id: data.id,
    telegramUserId: data.telegram_user_id,
    content: data.content,
    category: data.category as MemoryCategory,
    sourceMessage: data.source_message,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  };
}

/**
 * Search memories by semantic similarity
 *
 * @param telegramUserId - Telegram user ID
 * @param query - Search query text
 * @param limit - Maximum number of results (default: 5)
 * @returns Array of memories with similarity scores
 * @throws Error if embedding generation or search fails
 */
export async function searchMemories(
  telegramUserId: number,
  query: string,
  limit: number = 5
): Promise<MemorySearchResult[]> {
  const supabase = getSupabase();

  // Generate query embedding for semantic search
  const queryEmbedding = await getEmbedding(query);

  // Use RPC for vector search with cosine distance
  const { data, error } = await supabase.rpc("search_user_memories", {
    user_id: telegramUserId,
    query_embedding: JSON.stringify(queryEmbedding),
    match_limit: limit,
  });

  if (error) {
    throw new Error(`Failed to search memories: ${error.message}`);
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    content: row.content,
    category: row.category,
    score: row.similarity,
  }));
}

/**
 * Get all memories for user, ordered by creation date
 *
 * @param telegramUserId - Telegram user ID
 * @returns Array of all user memories (newest first)
 * @throws Error if database query fails
 */
export async function getAllMemories(
  telegramUserId: number
): Promise<UserMemory[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("user_memories")
    .select(
      "id, telegram_user_id, content, category, source_message, created_at, updated_at"
    )
    .eq("telegram_user_id", telegramUserId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to get memories: ${error.message}`);
  }

  return (data || []).map((row) => ({
    id: row.id,
    telegramUserId: row.telegram_user_id,
    content: row.content,
    category: row.category as MemoryCategory,
    sourceMessage: row.source_message,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }));
}

/**
 * Delete a memory by ID
 *
 * @param memoryId - UUID of the memory to delete
 * @throws Error if database deletion fails
 */
export async function deleteMemory(memoryId: string): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from("user_memories")
    .delete()
    .eq("id", memoryId);

  if (error) {
    throw new Error(`Failed to delete memory: ${error.message}`);
  }
}

/**
 * Calculate cosine similarity between two embedding vectors
 *
 * @param vec1 - First embedding vector
 * @param vec2 - Second embedding vector
 * @returns Similarity score between 0 and 1 (1 = identical)
 */
function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length || vec1.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    const v1 = vec1[i]!;
    const v2 = vec2[i]!;
    dotProduct += v1 * v2;
    magnitude1 += v1 * v1;
    magnitude2 += v2 * v2;
  }

  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);

  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }

  return dotProduct / (magnitude1 * magnitude2);
}

/**
 * Memory category priority for determining which is more specific
 * Lower number = more specific/important
 */
const CATEGORY_PRIORITY: Record<MemoryCategory, number> = {
  personal_info: 1,
  health: 2,
  work: 3,
  preferences: 4,
  interests: 5,
  events: 6,
  other: 7,
};

/**
 * Internal memory type with embedding for consolidation
 */
interface MemoryWithEmbedding {
  id: string;
  telegramUserId: number;
  content: string;
  category: MemoryCategory;
  embedding: number[];
  sourceMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Consolidate similar memories for a user
 * Merges duplicate/similar facts into single memories
 *
 * Algorithm:
 * 1. Get all memories for user with embeddings
 * 2. Compare embeddings pairwise using cosine similarity
 * 3. Find pairs with similarity > 0.85
 * 4. For each similar pair, merge:
 *    - Keep the newer memory
 *    - Append older content to newer (if different)
 *    - Update category to more specific if applicable
 *    - Delete the older memory
 *
 * @param telegramUserId - User's Telegram ID
 * @returns Number of memories consolidated
 */
export async function consolidateMemories(
  telegramUserId: number
): Promise<number> {
  const logger = getLogger().child({ service: "memory", action: "consolidate" });
  const supabase = getSupabase();
  const SIMILARITY_THRESHOLD = 0.85;

  logger.info({ telegramUserId }, "Starting memory consolidation");

  // Fetch all memories with embeddings
  const { data: rawMemories, error } = await supabase
    .from("user_memories")
    .select("id, telegram_user_id, content, category, embedding, source_message, created_at, updated_at")
    .eq("telegram_user_id", telegramUserId)
    .order("created_at", { ascending: false });

  if (error) {
    logger.error({ error: error.message }, "Failed to fetch memories for consolidation");
    throw new Error(`Failed to fetch memories: ${error.message}`);
  }

  if (!rawMemories || rawMemories.length < 2) {
    logger.info({ count: rawMemories?.length ?? 0 }, "Not enough memories to consolidate");
    return 0;
  }

  // Parse embeddings from JSONB string
  const memories: MemoryWithEmbedding[] = rawMemories.map((row) => {
    let embedding: number[] = [];
    if (row.embedding) {
      try {
        // Embedding is stored as JSON string, parse it
        embedding = typeof row.embedding === "string"
          ? JSON.parse(row.embedding)
          : row.embedding;
      } catch {
        logger.warn({ memoryId: row.id }, "Failed to parse embedding, skipping");
      }
    }
    return {
      id: row.id,
      telegramUserId: row.telegram_user_id,
      content: row.content,
      category: row.category as MemoryCategory,
      embedding,
      sourceMessage: row.source_message,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  });

  // Track which memories have been merged (to avoid double-processing)
  const mergedIds = new Set<string>();
  let consolidatedCount = 0;

  // Compare all pairs
  for (let i = 0; i < memories.length; i++) {
    const memory1 = memories[i];
    if (!memory1) continue;

    // Skip if already merged
    if (mergedIds.has(memory1.id) || memory1.embedding.length === 0) {
      continue;
    }

    for (let j = i + 1; j < memories.length; j++) {
      const memory2 = memories[j];
      if (!memory2) continue;

      // Skip if already merged or no embedding
      if (mergedIds.has(memory2.id) || memory2.embedding.length === 0) {
        continue;
      }

      const similarity = cosineSimilarity(memory1.embedding, memory2.embedding);

      if (similarity > SIMILARITY_THRESHOLD) {
        logger.debug(
          {
            memory1Id: memory1.id,
            memory2Id: memory2.id,
            similarity: similarity.toFixed(4)
          },
          "Found similar memories"
        );

        // Determine which is newer (keep the newer one)
        // memory1 is always newer due to ordering (descending by created_at)
        const newerMemory = memory1;
        const olderMemory = memory2;

        // Merge content if different
        let mergedContent = newerMemory.content;
        if (olderMemory.content !== newerMemory.content) {
          // Append older content if it adds information
          mergedContent = `${newerMemory.content}\n\n[Previous info]: ${olderMemory.content}`;
        }

        // Use more specific category
        let mergedCategory: MemoryCategory = newerMemory.category;
        if (CATEGORY_PRIORITY[olderMemory.category] < CATEGORY_PRIORITY[newerMemory.category]) {
          mergedCategory = olderMemory.category;
        }

        // Update the newer memory with merged content and category
        const { error: updateError } = await supabase
          .from("user_memories")
          .update({
            content: mergedContent,
            category: mergedCategory,
            updated_at: new Date().toISOString(),
          })
          .eq("id", newerMemory.id);

        if (updateError) {
          logger.error(
            { memoryId: newerMemory.id, error: updateError.message },
            "Failed to update memory during consolidation"
          );
          continue;
        }

        // Delete the older memory
        const { error: deleteError } = await supabase
          .from("user_memories")
          .delete()
          .eq("id", olderMemory.id);

        if (deleteError) {
          logger.error(
            { memoryId: olderMemory.id, error: deleteError.message },
            "Failed to delete old memory during consolidation"
          );
          continue;
        }

        // Mark the older memory as merged
        mergedIds.add(olderMemory.id);
        consolidatedCount++;

        logger.info(
          {
            keptMemoryId: newerMemory.id,
            deletedMemoryId: olderMemory.id,
            similarity: similarity.toFixed(4),
            mergedCategory,
          },
          "Merged similar memories"
        );
      }
    }
  }

  logger.info(
    { telegramUserId, consolidatedCount, originalCount: memories.length },
    "Memory consolidation complete"
  );

  return consolidatedCount;
}
