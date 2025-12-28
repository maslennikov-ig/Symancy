/**
 * Auth Utilities
 *
 * Shared authentication helper functions.
 *
 * @module utils/auth
 */

/**
 * Extract Bearer token from Authorization header
 *
 * @param authorization - Authorization header value
 * @returns Token string or null if invalid/missing
 *
 * @example
 * ```typescript
 * const token = extractBearerToken('Bearer eyJhbGciOiJIUzI1...');
 * // Returns: 'eyJhbGciOiJIUzI1...'
 *
 * const invalid = extractBearerToken('Basic abc123');
 * // Returns: null
 * ```
 */
export function extractBearerToken(authorization?: string): string | null {
  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }
  return authorization.slice(7);
}
