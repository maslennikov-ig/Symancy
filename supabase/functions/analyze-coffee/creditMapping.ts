/**
 * Credit Type Mapping
 * Maps analysis modes to credit types for consumption.
 */

export const MODE_TO_CREDIT_TYPE: Record<string, string> = {
  psychologist: 'basic',
  esoteric: 'cassandra',
  pro: 'pro',
};

/**
 * Get credit type for a given mode.
 * Supports explicit creditType override from client.
 *
 * @param mode - Analysis mode (psychologist, esoteric, pro)
 * @param explicitType - Optional explicit credit type from client
 * @returns Credit type to consume
 */
export function getCreditType(mode: string, explicitType?: string): string {
  // Explicit type takes precedence if provided
  if (explicitType && isValidCreditType(explicitType)) {
    return explicitType;
  }

  // Fall back to mode-based mapping
  return MODE_TO_CREDIT_TYPE[mode] || 'basic';
}

/**
 * Validate credit type
 */
function isValidCreditType(type: string): boolean {
  return ['basic', 'cassandra', 'pro'].includes(type);
}
