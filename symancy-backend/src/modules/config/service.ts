/**
 * Dynamic config service with caching
 * Provides runtime configuration with 60-second cache TTL
 */
import { z } from "zod";
import { getSupabase } from "../../core/database.js";
import { getLogger } from "../../core/logger.js";
import { CONFIG_CACHE_TTL_SECONDS } from "../../config/constants.js";

const logger = getLogger().child({ module: "config" });

// In-memory cache
const cache = new Map<string, { value: unknown; expiresAt: number }>();

/**
 * Get config value with caching
 * @param key - Config key
 * @param defaultValue - Default value if not found
 * @param schema - Optional Zod schema for validation
 */
export async function getConfig<T>(
  key: string,
  defaultValue: T,
  schema?: z.ZodSchema<T>
): Promise<T> {
  // Check cache first
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T;
  }

  // Fetch from database
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("system_config")
    .select("value")
    .eq("key", key)
    .single();

  if (error || !data) {
    logger.debug({ key, defaultValue }, "Config not found, using default");
    return defaultValue;
  }

  // Validate with schema if provided
  if (schema) {
    const result = schema.safeParse(data.value);
    if (!result.success) {
      logger.warn(
        { key, error: result.error.format(), value: data.value },
        "Config validation failed, using default"
      );
      return defaultValue;
    }

    // Update cache with validated value
    cache.set(key, {
      value: result.data,
      expiresAt: Date.now() + CONFIG_CACHE_TTL_SECONDS * 1000,
    });

    return result.data;
  }

  // Update cache
  cache.set(key, {
    value: data.value,
    expiresAt: Date.now() + CONFIG_CACHE_TTL_SECONDS * 1000,
  });

  return data.value as T;
}

/**
 * Set config value
 */
export async function setConfig(key: string, value: unknown): Promise<boolean> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("system_config")
    .upsert({ key, value, updated_at: new Date().toISOString() });
  
  if (error) {
    logger.error({ key, error }, "Failed to set config");
    return false;
  }
  
  // Invalidate cache
  cache.delete(key);
  logger.info({ key }, "Config updated");
  return true;
}

/**
 * Check if maintenance mode is enabled
 */
export async function isMaintenanceMode(): Promise<boolean> {
  return getConfig("maintenance_mode", false);
}

/**
 * Get daily chat limit
 */
export async function getDailyChatLimit(): Promise<number> {
  return getConfig("daily_chat_limit", 50);
}

/**
 * Clear all cached config values
 */
export function clearConfigCache(): void {
  cache.clear();
  logger.info("Config cache cleared");
}
