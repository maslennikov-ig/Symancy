import { createClient } from "npm:@supabase/supabase-js@2"

// ============================================================================
// Types
// ============================================================================

export type ConfigValue = string | number | boolean | null

export interface ConfigResult<T extends ConfigValue> {
  value: T
  source: 'db' | 'cache' | 'fallback'
  error?: string
}

interface CacheEntry {
  value: ConfigValue
  timestamp: number
}

// ============================================================================
// Cache
// ============================================================================

const configCache = new Map<string, CacheEntry>()
const CACHE_TTL = 60 * 1000 // 60 seconds (matches symancy-backend CONFIG_CACHE_TTL_SECONDS)

// ============================================================================
// Logging
// ============================================================================

type ConfigLogEvent = 'CONFIG_DB_ERROR' | 'CONFIG_NOT_FOUND' | 'CONFIG_FETCH_EXCEPTION' | 'CONFIG_TYPE_MISMATCH'

function logConfigEvent(
  event: ConfigLogEvent,
  key: string,
  details?: Record<string, unknown>
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event,
    configKey: key,
    ...details,
  }
  if (event === 'CONFIG_FETCH_EXCEPTION' || event === 'CONFIG_DB_ERROR') {
    console.error(JSON.stringify(logEntry))
  } else {
    console.warn(JSON.stringify(logEntry))
  }
}

// ============================================================================
// Main getter
// ============================================================================

/**
 * Read a single config value from system_config with TTL cache and fallback.
 *
 * Behaviour mirrors symancy-backend `getConfig()` so admin panel controls
 * both Telegram bot and Web Edge Function from one place.
 *
 * - Returns cached value while TTL is valid.
 * - On DB error / not found / type mismatch, returns `fallback`.
 * - On successful fetch, refreshes cache.
 */
export async function getConfig<T extends ConfigValue>(
  supabase: ReturnType<typeof createClient>,
  key: string,
  fallback: T
): Promise<ConfigResult<T>> {
  const now = Date.now()

  // Cache hit (still fresh)
  const cached = configCache.get(key)
  if (cached && now - cached.timestamp < CACHE_TTL) {
    if (typeof cached.value === typeof fallback || cached.value === null) {
      return { value: cached.value as T, source: 'cache' }
    }
    // Cached value has wrong type — fall through to refetch
  }

  try {
    const { data, error } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', key)
      .maybeSingle()

    if (error) {
      logConfigEvent('CONFIG_DB_ERROR', key, {
        errorCode: error.code,
        errorMessage: error.message,
      })
      return { value: fallback, source: 'fallback', error: `DB error: ${error.message}` }
    }

    if (!data || data.value === null || data.value === undefined) {
      logConfigEvent('CONFIG_NOT_FOUND', key)
      return { value: fallback, source: 'fallback', error: 'Not found' }
    }

    const rawValue = data.value as ConfigValue

    // Type-check against fallback
    if (typeof rawValue !== typeof fallback) {
      logConfigEvent('CONFIG_TYPE_MISMATCH', key, {
        expectedType: typeof fallback,
        actualType: typeof rawValue,
        actualValue: rawValue,
      })
      return {
        value: fallback,
        source: 'fallback',
        error: `Type mismatch: expected ${typeof fallback}, got ${typeof rawValue}`,
      }
    }

    configCache.set(key, { value: rawValue, timestamp: now })
    return { value: rawValue as T, source: 'db' }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    logConfigEvent('CONFIG_FETCH_EXCEPTION', key, {
      error: errorMessage,
      stack: err instanceof Error ? err.stack : undefined,
    })
    return { value: fallback, source: 'fallback', error: `Exception: ${errorMessage}` }
  }
}

/**
 * Convenience helper: returns only the resolved value (drops source/error).
 * Use this when you don't need to know where the value came from.
 */
export async function getConfigValue<T extends ConfigValue>(
  supabase: ReturnType<typeof createClient>,
  key: string,
  fallback: T
): Promise<T> {
  const result = await getConfig(supabase, key, fallback)
  return result.value
}
