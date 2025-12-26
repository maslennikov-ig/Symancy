/**
 * Database client factory
 * - Supabase client for service role operations
 * - PostgreSQL connection pool for pg-boss and direct queries
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import pg from "pg";
import { getEnv } from "../config/env.js";
import { getLogger } from "./logger.js";
import { sendErrorAlert } from "../utils/admin-alerts.js";

const { Pool } = pg;

// Singleton instances
let _supabase: SupabaseClient | null = null;
let _pool: pg.Pool | null = null;

/**
 * Get Supabase client (uses service role key for backend operations)
 * This bypasses RLS policies and has full database access
 */
export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const env = getEnv();
    _supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    getLogger().child({ module: "database" }).info("Supabase client initialized");
  }
  return _supabase;
}

/**
 * Get PostgreSQL connection pool (for pg-boss and direct queries)
 * Pool is shared across the application for efficient connection management
 */
export function getPool(): pg.Pool {
  if (!_pool) {
    const env = getEnv();
    _pool = new Pool({
      connectionString: env.DATABASE_URL,
      // Connection pool settings (configurable via environment)
      max: env.DB_POOL_MAX,
      idleTimeoutMillis: env.DB_POOL_IDLE_TIMEOUT_MS,
      connectionTimeoutMillis: env.DB_POOL_CONNECTION_TIMEOUT_MS,
    });

    // Log pool errors and send admin alerts for critical database issues
    _pool.on("error", async (err) => {
      const logger = getLogger().child({ module: "database" });
      logger.error({ err }, "PostgreSQL pool error");

      // Send admin alert for critical database issues
      await sendErrorAlert(err as Error, {
        module: "database",
        severity: "critical",
      }).catch(() => {}); // Don't let alert failure crash app
    });

    getLogger().child({ module: "database" }).info("PostgreSQL pool initialized");
  }
  return _pool;
}

/**
 * Close all database connections (for graceful shutdown)
 * Should be called when the application is shutting down
 */
export async function closeDatabase(): Promise<void> {
  const logger = getLogger().child({ module: "database" });

  if (_pool) {
    await _pool.end();
    _pool = null;
    logger.info("PostgreSQL pool closed");
  }

  // Supabase client doesn't need explicit cleanup
  _supabase = null;
}
