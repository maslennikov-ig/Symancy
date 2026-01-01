/**
 * A/B Testing Service
 *
 * Provides deterministic experiment variant assignment based on user ID.
 * Variants are assigned using a hash function to ensure consistent
 * assignment across sessions while maintaining statistical distribution.
 *
 * @module services/abTestingService
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Experiment definition with variants
 */
export interface Experiment {
  /** Unique experiment identifier */
  id: string;
  /** Available variants for this experiment */
  variants: string[];
  /** Default variant if assignment fails */
  defaultVariant: string;
}

// ============================================================================
// Experiment Definitions
// ============================================================================

/**
 * Active experiments in the application.
 * Add new experiments here with unique IDs.
 */
export const EXPERIMENTS: Record<string, Experiment> = {
  onboarding_flow: {
    id: 'onboarding_flow',
    variants: ['control', 'simplified'],
    defaultVariant: 'control',
  },
  share_button_style: {
    id: 'share_button_style',
    variants: ['icon', 'text', 'icon_text'],
    defaultVariant: 'icon_text',
  },
  daily_insight_position: {
    id: 'daily_insight_position',
    variants: ['top', 'bottom'],
    defaultVariant: 'top',
  },
};

// ============================================================================
// Hash Function
// ============================================================================

/**
 * DJB2 hash function for deterministic variant assignment.
 * Creates a consistent numeric hash from a string.
 *
 * @param str - String to hash
 * @returns Positive integer hash value
 */
function djb2Hash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    // hash * 33 + char code
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    // Keep as 32-bit integer
    hash = hash >>> 0;
  }
  return hash;
}

// ============================================================================
// Variant Assignment
// ============================================================================

/**
 * Assign a variant for an experiment based on user ID.
 * Uses deterministic hashing to ensure consistent assignment.
 *
 * @param experimentId - The experiment identifier
 * @param userId - The user identifier (Telegram user ID or anonymous ID)
 * @returns The assigned variant string
 *
 * @example
 * ```ts
 * const variant = assignVariant('onboarding_flow', '123456789');
 * // Returns 'control' or 'simplified' consistently for the same user
 * ```
 */
export function assignVariant(experimentId: string, userId: string): string {
  const experiment = EXPERIMENTS[experimentId];

  if (!experiment) {
    console.warn(`[abTestingService] Unknown experiment: ${experimentId}`);
    return 'control';
  }

  if (!userId) {
    console.warn(`[abTestingService] No userId provided, using default variant`);
    return experiment.defaultVariant;
  }

  try {
    // Create deterministic hash from experiment:userId combination
    const hashInput = `${experimentId}:${userId}`;
    const hash = djb2Hash(hashInput);

    // Map hash to variant index
    const variantIndex = hash % experiment.variants.length;
    return experiment.variants[variantIndex];
  } catch (error) {
    console.error('[abTestingService] Error assigning variant:', error);
    return experiment.defaultVariant;
  }
}

/**
 * Get all variant assignments for a user across all experiments.
 * Useful for analytics and debugging.
 *
 * @param userId - The user identifier
 * @returns Record mapping experiment IDs to assigned variants
 *
 * @example
 * ```ts
 * const variants = getAllVariants('123456789');
 * // Returns: { onboarding_flow: 'control', share_button_style: 'icon', ... }
 * ```
 */
export function getAllVariants(userId: string): Record<string, string> {
  const variants: Record<string, string> = {};

  for (const experimentId of Object.keys(EXPERIMENTS)) {
    variants[experimentId] = assignVariant(experimentId, userId);
  }

  return variants;
}

/**
 * Get a specific experiment definition.
 * Useful for checking available variants.
 *
 * @param experimentId - The experiment identifier
 * @returns The experiment definition or null if not found
 */
export function getExperiment(experimentId: string): Experiment | null {
  return EXPERIMENTS[experimentId] || null;
}

/**
 * List all active experiment IDs.
 *
 * @returns Array of experiment identifiers
 */
export function listExperiments(): string[] {
  return Object.keys(EXPERIMENTS);
}
