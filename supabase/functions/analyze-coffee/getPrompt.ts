import { createClient } from "npm:@supabase/supabase-js@2"
import { z } from "npm:zod@3"

// ============================================================================
// Types
// ============================================================================

export interface PromptResult {
  content: string
  source: 'db' | 'cache' | 'fallback'
  error?: string
}

interface CacheEntry {
  content: string
  version: number
  timestamp: number
}

// ============================================================================
// Zod Schema for DB Response Validation (MEDIUM-2)
// ============================================================================

const PromptDbResponseSchema = z.object({
  content: z.string().min(10, "Prompt content must be at least 10 characters"),
  version: z.number().int().nonnegative().nullable().transform(v => v ?? 0)
})

type PromptDbResponse = z.infer<typeof PromptDbResponseSchema>

// ============================================================================
// LRU Cache Implementation (MEDIUM-3)
// ============================================================================

class LRUCache<K, V> {
  private cache: Map<K, V>
  private readonly maxSize: number

  constructor(maxSize: number) {
    this.cache = new Map()
    this.maxSize = maxSize
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key)
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key)
      this.cache.set(key, value)
    }
    return value
  }

  set(key: K, value: V): void {
    // Delete if exists to refresh position
    if (this.cache.has(key)) {
      this.cache.delete(key)
    }
    // Evict oldest (first) entry if at capacity
    else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) {
        this.cache.delete(firstKey)
      }
    }
    this.cache.set(key, value)
  }

  delete(key: K): boolean {
    return this.cache.delete(key)
  }

  has(key: K): boolean {
    return this.cache.has(key)
  }
}

// ============================================================================
// Cache Configuration
// ============================================================================

const promptCache = new LRUCache<string, CacheEntry>(10) // Max 10 entries
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// ============================================================================
// Structured Error Logging (HIGH-1)
// ============================================================================

type PromptLogEvent = 'PROMPT_DB_ERROR' | 'PROMPT_NOT_FOUND' | 'PROMPT_FETCH_EXCEPTION' | 'PROMPT_VALIDATION_ERROR'

function logPromptEvent(
  event: PromptLogEvent,
  key: string,
  details?: Record<string, unknown>
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event,
    promptKey: key,
    ...details
  }

  if (event === 'PROMPT_FETCH_EXCEPTION' || event === 'PROMPT_DB_ERROR') {
    console.error(JSON.stringify(logEntry))
  } else {
    console.warn(JSON.stringify(logEntry))
  }
}

// ============================================================================
// Main Function
// ============================================================================

export async function getPrompt(
  supabase: ReturnType<typeof createClient>,
  key: 'vision' | 'arina' | 'cassandra',
  fallback: string
): Promise<PromptResult> {
  const now = Date.now()

  // Check cache first
  const cached = promptCache.get(key)

  try {
    // Fetch from DB to check version (even if cached, to validate version)
    const { data, error } = await supabase
      .from('prompts')
      .select('content, version')
      .eq('key', key)
      .eq('is_active', true)
      .single()

    // Handle DB error
    if (error) {
      logPromptEvent('PROMPT_DB_ERROR', key, {
        errorCode: error.code,
        errorMessage: error.message,
        errorDetails: error.details
      })

      // Return cached if available despite DB error
      if (cached && now - cached.timestamp < CACHE_TTL) {
        return {
          content: cached.content,
          source: 'cache',
          error: `DB error (using cache): ${error.message}`
        }
      }

      return {
        content: fallback,
        source: 'fallback',
        error: `DB error: ${error.message}`
      }
    }

    // Handle not found
    if (!data) {
      logPromptEvent('PROMPT_NOT_FOUND', key)

      // Return cached if available
      if (cached && now - cached.timestamp < CACHE_TTL) {
        return {
          content: cached.content,
          source: 'cache',
          error: 'Prompt not found in DB (using cache)'
        }
      }

      return {
        content: fallback,
        source: 'fallback',
        error: 'Prompt not found in DB'
      }
    }

    // Validate DB response with Zod (MEDIUM-2)
    const validationResult = PromptDbResponseSchema.safeParse(data)

    if (!validationResult.success) {
      const validationErrors = validationResult.error.issues
        .map(issue => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ')

      logPromptEvent('PROMPT_VALIDATION_ERROR', key, {
        validationErrors,
        receivedData: data
      })

      // Return cached if available
      if (cached && now - cached.timestamp < CACHE_TTL) {
        return {
          content: cached.content,
          source: 'cache',
          error: `Validation error (using cache): ${validationErrors}`
        }
      }

      return {
        content: fallback,
        source: 'fallback',
        error: `Validation error: ${validationErrors}`
      }
    }

    const validData: PromptDbResponse = validationResult.data

    // Version-based cache invalidation (HIGH-2)
    // If cache exists and version matches and not expired, use cache
    if (cached && cached.version === validData.version && now - cached.timestamp < CACHE_TTL) {
      return {
        content: cached.content,
        source: 'cache'
      }
    }

    // Update cache with new data
    promptCache.set(key, {
      content: validData.content,
      version: validData.version,
      timestamp: now
    })

    return {
      content: validData.content,
      source: 'db'
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)

    logPromptEvent('PROMPT_FETCH_EXCEPTION', key, {
      error: errorMessage,
      stack: err instanceof Error ? err.stack : undefined
    })

    // Return cached if available despite exception
    if (cached && now - cached.timestamp < CACHE_TTL) {
      return {
        content: cached.content,
        source: 'cache',
        error: `Exception (using cache): ${errorMessage}`
      }
    }

    return {
      content: fallback,
      source: 'fallback',
      error: `Exception: ${errorMessage}`
    }
  }
}
