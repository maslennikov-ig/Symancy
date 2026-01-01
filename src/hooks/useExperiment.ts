/**
 * A/B Testing Experiment Hook
 *
 * Provides React hook for consuming A/B test experiments.
 * Uses Telegram CloudStorage for persistence with localStorage fallback.
 *
 * @module hooks/useExperiment
 */
import { useState, useEffect, useRef } from 'react';
import { useTelegramWebApp } from './useTelegramWebApp';
import { assignVariant, getExperiment } from '../services/abTestingService';

// ============================================================================
// Types
// ============================================================================

/**
 * Hook return type
 */
export interface UseExperimentReturn {
  /** Assigned variant for this experiment (null while loading) */
  variant: string | null;
  /** Whether the experiment is still loading */
  isLoading: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Prefix for CloudStorage keys
 */
const STORAGE_KEY_PREFIX = 'ab_';

/**
 * LocalStorage key for anonymous user ID
 */
const ANONYMOUS_ID_KEY = 'ab_anonymous_id';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a random anonymous ID for non-Telegram users
 */
function generateAnonymousId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `anon_${timestamp}_${randomPart}`;
}

/**
 * Get or create anonymous ID from localStorage
 */
function getOrCreateAnonymousId(): string {
  try {
    let id = localStorage.getItem(ANONYMOUS_ID_KEY);
    if (!id) {
      id = generateAnonymousId();
      localStorage.setItem(ANONYMOUS_ID_KEY, id);
    }
    return id;
  } catch {
    // localStorage not available, generate ephemeral ID
    return generateAnonymousId();
  }
}

/**
 * Get CloudStorage API (returns null if not available)
 */
function getCloudStorage() {
  return window.Telegram?.WebApp?.CloudStorage || null;
}

/**
 * Get item from CloudStorage with localStorage fallback
 */
function storageGetItem(key: string): Promise<string | null> {
  return new Promise((resolve) => {
    const storage = getCloudStorage();

    if (!storage) {
      // Fallback to localStorage
      try {
        resolve(localStorage.getItem(key));
      } catch {
        resolve(null);
      }
      return;
    }

    storage.getItem(key, (error, value) => {
      if (error) {
        // Fallback to localStorage on error
        try {
          resolve(localStorage.getItem(key));
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
 * Set item in CloudStorage with localStorage fallback
 */
function storageSetItem(key: string, value: string): Promise<boolean> {
  return new Promise((resolve) => {
    const storage = getCloudStorage();

    // Always save to localStorage as backup
    try {
      localStorage.setItem(key, value);
    } catch (err) {
      console.warn('[useExperiment] localStorage backup failed:', err);
    }

    if (!storage) {
      resolve(true);
      return;
    }

    storage.setItem(key, value, (error, success) => {
      if (error) {
        console.warn('[useExperiment] CloudStorage.setItem error:', error);
        resolve(true); // localStorage already saved
      } else {
        resolve(success);
      }
    });
  });
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for consuming A/B test experiments.
 *
 * Provides deterministic variant assignment based on user ID,
 * with caching in CloudStorage for persistence.
 *
 * @param experimentId - The experiment identifier (must exist in EXPERIMENTS)
 * @returns Variant and loading state
 *
 * @example
 * ```tsx
 * function OnboardingFlow() {
 *   const { variant, isLoading } = useExperiment('onboarding_flow');
 *
 *   if (isLoading) return <Spinner />;
 *
 *   if (variant === 'simplified') {
 *     return <SimplifiedOnboarding />;
 *   }
 *
 *   return <StandardOnboarding />;
 * }
 * ```
 */
export function useExperiment(experimentId: string): UseExperimentReturn {
  const [variant, setVariant] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user, isReady } = useTelegramWebApp();

  // Track initialization to prevent race conditions
  const initRef = useRef(false);

  useEffect(() => {
    // Check if we're in Telegram environment
    const isTelegram = !!window.Telegram?.WebApp;

    if (!isTelegram) {
      // Not in Telegram - initialize immediately
      initializeExperiment();
      return;
    }

    // In Telegram - wait for ready event or timeout
    const initTimeout = setTimeout(() => {
      if (!initRef.current) {
        initializeExperiment();
      }
    }, 100);

    if (isReady) {
      clearTimeout(initTimeout);
      initializeExperiment();
    }

    async function initializeExperiment() {
      if (initRef.current) return;
      initRef.current = true;

      try {
        // Validate experiment exists
        const experiment = getExperiment(experimentId);
        if (!experiment) {
          console.warn(`[useExperiment] Unknown experiment: ${experimentId}`);
          setVariant('control');
          setIsLoading(false);
          return;
        }

        const storageKey = `${STORAGE_KEY_PREFIX}${experimentId}`;

        // Check for cached variant first
        const cachedVariant = await storageGetItem(storageKey);
        if (cachedVariant && experiment.variants.includes(cachedVariant)) {
          setVariant(cachedVariant);
          setIsLoading(false);
          return;
        }

        // Get user ID - Telegram user ID or anonymous ID
        const userId = user?.id?.toString() || getOrCreateAnonymousId();

        // Assign variant deterministically
        const assignedVariant = assignVariant(experimentId, userId);

        // Cache the variant
        await storageSetItem(storageKey, assignedVariant);

        setVariant(assignedVariant);
      } catch (error) {
        console.error('[useExperiment] Error initializing experiment:', error);
        // Fall back to default variant
        const experiment = getExperiment(experimentId);
        setVariant(experiment?.defaultVariant || 'control');
      } finally {
        setIsLoading(false);
      }
    }

    return () => {
      clearTimeout(initTimeout);
    };
  }, [experimentId, user?.id, isReady]);

  return { variant, isLoading };
}

/**
 * Hook for getting all experiment variants at once.
 * Useful for analytics tracking.
 *
 * @returns All variants and loading state
 *
 * @example
 * ```tsx
 * function AnalyticsProvider() {
 *   const { variants, isLoading } = useAllExperiments();
 *
 *   useEffect(() => {
 *     if (!isLoading) {
 *       analytics.setUserProperties({ experiments: variants });
 *     }
 *   }, [variants, isLoading]);
 * }
 * ```
 */
export function useAllExperiments(): {
  variants: Record<string, string>;
  isLoading: boolean;
} {
  const [variants, setVariants] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const { user, isReady } = useTelegramWebApp();

  const initRef = useRef(false);

  useEffect(() => {
    // Check if we're in Telegram environment
    const isTelegram = !!window.Telegram?.WebApp;

    if (!isTelegram) {
      // Not in Telegram - initialize immediately
      initializeAllExperiments();
      return;
    }

    // In Telegram - wait for ready event or timeout
    const initTimeout = setTimeout(() => {
      if (!initRef.current) {
        initializeAllExperiments();
      }
    }, 100);

    if (isReady) {
      clearTimeout(initTimeout);
      initializeAllExperiments();
    }

    async function initializeAllExperiments() {
      if (initRef.current) return;
      initRef.current = true;

      try {
        const userId = user?.id?.toString() || getOrCreateAnonymousId();
        const { EXPERIMENTS } = await import('../services/abTestingService');

        const experimentIds = Object.keys(EXPERIMENTS);
        const results: Record<string, string> = {};

        for (const expId of experimentIds) {
          const storageKey = `${STORAGE_KEY_PREFIX}${expId}`;
          const experiment = EXPERIMENTS[expId];

          // Check cached value
          const cachedVariant = await storageGetItem(storageKey);
          if (cachedVariant && experiment.variants.includes(cachedVariant)) {
            results[expId] = cachedVariant;
          } else {
            // Assign and cache
            const assignedVariant = assignVariant(expId, userId);
            await storageSetItem(storageKey, assignedVariant);
            results[expId] = assignedVariant;
          }
        }

        setVariants(results);
      } catch (error) {
        console.error('[useAllExperiments] Error:', error);
      } finally {
        setIsLoading(false);
      }
    }

    return () => {
      clearTimeout(initTimeout);
    };
  }, [user?.id, isReady]);

  return { variants, isLoading };
}
