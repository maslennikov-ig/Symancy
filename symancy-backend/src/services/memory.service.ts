/**
 * Memory Service
 * Handles storage and retrieval of user memories with vector search
 */
import { getSupabase } from "../core/database.js";
import { getEmbedding } from "../core/embeddings/index.js";

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
