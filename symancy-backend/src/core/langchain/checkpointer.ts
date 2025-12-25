/**
 * PostgresSaver checkpointer factory
 * Creates and manages LangGraph checkpointer instances for state persistence
 */
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { getEnv } from "../../config/env.js";

/**
 * Singleton checkpointer instance
 * Reused across application lifecycle to avoid multiple connections
 */
let _checkpointer: PostgresSaver | null = null;

/**
 * Get or create PostgresSaver checkpointer instance
 * Initializes on first call and sets up required database tables
 *
 * @returns {Promise<PostgresSaver>} Configured checkpointer instance
 *
 * @example
 * const checkpointer = await getCheckpointer();
 * const app = graph.compile({ checkpointer });
 */
export async function getCheckpointer(): Promise<PostgresSaver> {
  if (!_checkpointer) {
    const env = getEnv();

    // Create checkpointer from database connection string
    _checkpointer = PostgresSaver.fromConnString(env.DATABASE_URL);

    // Setup required tables (creates if not exists)
    // Creates: checkpoints, checkpoint_blobs, checkpoint_writes tables
    await _checkpointer.setup();
  }

  return _checkpointer;
}

/**
 * Close checkpointer connection and cleanup resources
 * Should be called during application shutdown
 *
 * @example
 * process.on('SIGTERM', async () => {
 *   await closeCheckpointer();
 *   process.exit(0);
 * });
 */
export async function closeCheckpointer(): Promise<void> {
  if (_checkpointer) {
    // PostgresSaver.end() closes the internal pg.Pool connection
    // This prevents resource leaks and ensures graceful shutdown
    await _checkpointer.end();
    _checkpointer = null;
  }
}
