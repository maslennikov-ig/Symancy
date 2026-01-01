/**
 * Telegram CloudStorage Hook
 *
 * Provides syncing of user preferences using Telegram CloudStorage API (Bot API 6.9+).
 * Falls back to localStorage for non-Telegram environments.
 *
 * @module hooks/useCloudStorage
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import type { TelegramWebApp } from './useTelegramWebApp';

// ============================================================================
// Types
// ============================================================================

/**
 * Supported languages in the application
 */
export type Language = 'ru' | 'en' | 'zh';

/**
 * Theme options including auto (follows system/Telegram)
 */
export type ThemeOption = 'light' | 'dark' | 'auto';

/**
 * Available AI personas
 */
export type Persona = 'arina' | 'cassandra';

/**
 * User preferences stored in CloudStorage
 */
export interface UserPreferences {
  /** UI language */
  language: Language;
  /** Theme setting */
  theme: ThemeOption;
  /** Selected AI persona */
  persona: Persona;
  /** Whether push notifications are enabled */
  notificationsEnabled: boolean;
  /** Time for daily insight notifications (e.g., '09:00') */
  dailyInsightTime?: string;
}

/**
 * Cached daily insight data
 */
export interface DailyInsightCache {
  /** ISO date string (YYYY-MM-DD) */
  date: string;
  /** Cached insight content */
  content: string;
  /** Persona that generated the insight */
  persona: Persona;
}

/**
 * Hook return type
 */
export interface CloudStorageReturn {
  /** Current user preferences */
  preferences: UserPreferences;
  /** Whether preferences are being loaded */
  isLoading: boolean;
  /** Error message if loading/saving failed */
  error: string | null;
  /** Whether onboarding has been completed */
  onboardingCompleted: boolean;
  /** Cached daily insight (if available) */
  dailyInsightCache: DailyInsightCache | null;
  /** Update one or more preferences */
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
  /** Reset preferences to defaults */
  resetPreferences: () => Promise<void>;
  /** Mark onboarding as completed */
  setOnboardingCompleted: (completed: boolean) => Promise<void>;
  /** Cache a daily insight */
  cacheDailyInsight: (cache: DailyInsightCache) => Promise<void>;
  /** Clear cached daily insight */
  clearDailyInsightCache: () => Promise<void>;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * CloudStorage keys used by the application
 */
const STORAGE_KEYS = {
  /** User preferences (language, theme, persona, notifications) */
  PREFERENCES: 'user_preferences',
  /** Onboarding completion status */
  ONBOARDING: 'onboarding_completed',
  /** Daily insight cache with date validation */
  DAILY_INSIGHT: 'daily_insight_cache',
} as const;

/**
 * Default preferences for new users
 */
const DEFAULT_PREFERENCES: UserPreferences = {
  language: 'ru',
  theme: 'auto',
  persona: 'arina',
  notificationsEnabled: true,
};

// ============================================================================
// CloudStorage API Types
// ============================================================================

/**
 * CloudStorage API type extracted from TelegramWebApp
 * Defined in useTelegramWebApp.ts for type consistency
 */
type CloudStorageAPI = NonNullable<TelegramWebApp['CloudStorage']>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if CloudStorage API is available
 */
function isCloudStorageAvailable(): boolean {
  return !!window.Telegram?.WebApp?.CloudStorage;
}

/**
 * Get CloudStorage API (returns null if not available)
 */
function getCloudStorage(): CloudStorageAPI | null {
  return window.Telegram?.WebApp?.CloudStorage || null;
}

/**
 * Promisified wrapper for CloudStorage.getItem with localStorage fallback
 *
 * @param key - Storage key to retrieve
 * @returns Promise resolving to stored value or null if not found
 */
function cloudStorageGetItem(key: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const storage = getCloudStorage();
    if (!storage) {
      // Fallback to localStorage
      try {
        const value = localStorage.getItem(key);
        resolve(value);
      } catch (err) {
        console.warn('[useCloudStorage] localStorage fallback failed:', err);
        resolve(null);
      }
      return;
    }

    storage.getItem(key, (error, value) => {
      if (error) {
        console.warn('[useCloudStorage] CloudStorage.getItem error:', error);
        // Fallback to localStorage on error
        try {
          const fallbackValue = localStorage.getItem(key);
          resolve(fallbackValue);
        } catch {
          resolve(null);
        }
      } else {
        resolve(value);
      }
    });
  });
}

/**
 * Promisified wrapper for CloudStorage.setItem with localStorage fallback
 *
 * @param key - Storage key to set
 * @param value - Value to store
 * @returns Promise resolving to success status when value is stored
 */
function cloudStorageSetItem(key: string, value: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const storage = getCloudStorage();

    // Always save to localStorage as backup
    try {
      localStorage.setItem(key, value);
    } catch (err) {
      console.warn('[useCloudStorage] localStorage backup failed:', err);
    }

    if (!storage) {
      // localStorage already saved above
      resolve(true);
      return;
    }

    storage.setItem(key, value, (error, success) => {
      if (error) {
        console.warn('[useCloudStorage] CloudStorage.setItem error:', error);
        // localStorage already saved, consider it success
        resolve(true);
      } else {
        resolve(success);
      }
    });
  });
}

/**
 * Promisified wrapper for CloudStorage.removeItem with localStorage fallback
 *
 * @param key - Storage key to remove
 * @returns Promise resolving to success status when key is removed
 */
function cloudStorageRemoveItem(key: string): Promise<boolean> {
  return new Promise((resolve) => {
    const storage = getCloudStorage();

    // Always remove from localStorage
    try {
      localStorage.removeItem(key);
    } catch (err) {
      console.warn('[useCloudStorage] localStorage remove failed:', err);
    }

    if (!storage) {
      resolve(true);
      return;
    }

    storage.removeItem(key, (error, success) => {
      if (error) {
        console.warn('[useCloudStorage] CloudStorage.removeItem error:', error);
        resolve(true); // localStorage already cleared
      } else {
        resolve(success);
      }
    });
  });
}

/**
 * Safely parse JSON with fallback value
 *
 * @param json - JSON string to parse (may be null)
 * @param fallback - Fallback value if parsing fails or json is null
 * @returns Parsed value or fallback
 */
function safeJsonParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    console.warn('[useCloudStorage] Failed to parse JSON:', json);
    return fallback;
  }
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for syncing user preferences with Telegram CloudStorage
 *
 * Provides persistent storage for user preferences that syncs across
 * all Telegram devices. Falls back to localStorage for non-Telegram
 * environments (web browser, development).
 *
 * @returns CloudStorageReturn - Preferences state and update functions
 *
 * @example
 * ```tsx
 * function SettingsPage() {
 *   const {
 *     preferences,
 *     isLoading,
 *     updatePreferences
 *   } = useCloudStorage();
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <div>
 *       <select
 *         value={preferences.language}
 *         onChange={(e) => updatePreferences({ language: e.target.value as Language })}
 *       >
 *         <option value="ru">Русский</option>
 *         <option value="en">English</option>
 *         <option value="zh">中文</option>
 *       </select>
 *     </div>
 *   );
 * }
 * ```
 */
export function useCloudStorage(): CloudStorageReturn {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [onboardingCompleted, setOnboardingCompletedState] = useState(false);
  const [dailyInsightCache, setDailyInsightCache] = useState<DailyInsightCache | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track if initial load completed to prevent race conditions
  const initialLoadCompleteRef = useRef(false);

  // Load all data on mount
  useEffect(() => {
    let isMounted = true;

    async function loadStoredData() {
      try {
        setIsLoading(true);
        setError(null);

        // Load all storage items in parallel
        const [prefsJson, onboardingValue, insightJson] = await Promise.all([
          cloudStorageGetItem(STORAGE_KEYS.PREFERENCES),
          cloudStorageGetItem(STORAGE_KEYS.ONBOARDING),
          cloudStorageGetItem(STORAGE_KEYS.DAILY_INSIGHT),
        ]);

        // Only update state if still mounted
        if (!isMounted) return;

        // Parse preferences with defaults
        const loadedPrefs = safeJsonParse<Partial<UserPreferences>>(prefsJson, {});
        setPreferences({
          ...DEFAULT_PREFERENCES,
          ...loadedPrefs,
        });

        // Parse onboarding status
        setOnboardingCompletedState(onboardingValue === 'true');

        // Parse daily insight cache
        const parsedInsight = safeJsonParse<DailyInsightCache | null>(insightJson, null);

        // Validate cache date (only keep if from today)
        if (parsedInsight) {
          const today = new Date().toISOString().split('T')[0];
          if (parsedInsight.date === today) {
            setDailyInsightCache(parsedInsight);
          } else {
            // Clear stale cache
            await cloudStorageRemoveItem(STORAGE_KEYS.DAILY_INSIGHT);
            if (!isMounted) return;
            setDailyInsightCache(null);
          }
        }

        initialLoadCompleteRef.current = true;
      } catch (err) {
        if (!isMounted) return;
        console.error('[useCloudStorage] Failed to load stored data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load preferences');
        // Use defaults on error
        setPreferences(DEFAULT_PREFERENCES);
        initialLoadCompleteRef.current = true;
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadStoredData();

    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * Update one or more preferences
   * Uses functional update pattern to avoid stale closures and race conditions
   */
  const updatePreferences = useCallback(async (updates: Partial<UserPreferences>) => {
    // Wait for initial load to complete
    if (!initialLoadCompleteRef.current) {
      console.warn('[useCloudStorage] updatePreferences called before initial load');
      return;
    }

    try {
      setError(null);

      // Use functional update to avoid stale closures
      setPreferences(prevPrefs => {
        const newPrefs = { ...prevPrefs, ...updates };

        // Persist to storage asynchronously (don't await here)
        cloudStorageSetItem(
          STORAGE_KEYS.PREFERENCES,
          JSON.stringify(newPrefs)
        ).catch(err => {
          console.error('[useCloudStorage] Failed to save preferences:', err);
          setError(err instanceof Error ? err.message : 'Failed to save preferences');
        });

        return newPrefs;
      });
    } catch (err) {
      console.error('[useCloudStorage] updatePreferences error:', err);
      setError(err instanceof Error ? err.message : 'Failed to save preferences');
    }
  }, []); // No dependencies - stable reference

  /**
   * Reset preferences to defaults
   */
  const resetPreferences = useCallback(async () => {
    try {
      setError(null);
      setPreferences(DEFAULT_PREFERENCES);

      await cloudStorageSetItem(
        STORAGE_KEYS.PREFERENCES,
        JSON.stringify(DEFAULT_PREFERENCES)
      );
    } catch (err) {
      console.error('[useCloudStorage] resetPreferences error:', err);
      setError(err instanceof Error ? err.message : 'Failed to reset preferences');
    }
  }, []);

  /**
   * Set onboarding completion status
   */
  const setOnboardingCompleted = useCallback(async (completed: boolean) => {
    try {
      setError(null);
      setOnboardingCompletedState(completed);

      await cloudStorageSetItem(
        STORAGE_KEYS.ONBOARDING,
        completed ? 'true' : 'false'
      );
    } catch (err) {
      console.error('[useCloudStorage] setOnboardingCompleted error:', err);
      setError(err instanceof Error ? err.message : 'Failed to save onboarding status');
    }
  }, []);

  /**
   * Cache a daily insight
   */
  const cacheDailyInsight = useCallback(async (cache: DailyInsightCache) => {
    try {
      setError(null);
      setDailyInsightCache(cache);

      await cloudStorageSetItem(
        STORAGE_KEYS.DAILY_INSIGHT,
        JSON.stringify(cache)
      );
    } catch (err) {
      console.error('[useCloudStorage] cacheDailyInsight error:', err);
      setError(err instanceof Error ? err.message : 'Failed to cache daily insight');
    }
  }, []);

  /**
   * Clear cached daily insight
   */
  const clearDailyInsightCache = useCallback(async () => {
    try {
      setError(null);
      setDailyInsightCache(null);

      await cloudStorageRemoveItem(STORAGE_KEYS.DAILY_INSIGHT);
    } catch (err) {
      console.error('[useCloudStorage] clearDailyInsightCache error:', err);
      setError(err instanceof Error ? err.message : 'Failed to clear daily insight cache');
    }
  }, []);

  return {
    preferences,
    isLoading,
    error,
    onboardingCompleted,
    dailyInsightCache,
    updatePreferences,
    resetPreferences,
    setOnboardingCompleted,
    cacheDailyInsight,
    clearDailyInsightCache,
  };
}

/**
 * Check if Telegram CloudStorage is available (synchronous, for guards)
 *
 * @returns True if CloudStorage API is available
 */
export function hasCloudStorage(): boolean {
  return isCloudStorageAvailable();
}

/**
 * Default preferences export for external use
 */
export { DEFAULT_PREFERENCES };
