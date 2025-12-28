/**
 * Link Token Service
 *
 * Manages one-time link tokens for cross-channel authentication (Telegram ↔ Web).
 * Tokens are cryptographically secure, time-limited, and single-use.
 *
 * @module services/auth/LinkTokenService
 */

import { randomBytes } from 'node:crypto';
import { getSupabase } from '../../core/database.js';
import { getLogger } from '../../core/logger.js';
import { getEnv } from '../../config/env.js';
import type { UnifiedUser } from '../../types/omnichannel.js';

/**
 * Parameters for generating a link token
 */
export interface GenerateLinkTokenParams {
  /** Unified user ID to link */
  unifiedUserId: string;
  /** Channel initiating the link (telegram or web) */
  sourceChannel: 'telegram' | 'web';
}

/**
 * Result of link token generation
 */
export interface LinkTokenResult {
  /** Cryptographically secure 64-character hex token */
  token: string;
  /** Token expiration timestamp */
  expiresAt: Date;
  /** Full URL for frontend link page */
  linkUrl: string;
}

/**
 * Result of link token validation
 */
export interface ValidateLinkTokenResult {
  /** Whether the token is valid and was consumed successfully */
  valid: boolean;
  /** Reason for validation failure (if valid = false) */
  reason?: 'TOKEN_NOT_FOUND' | 'TOKEN_EXPIRED' | 'TOKEN_ALREADY_USED' | 'DATABASE_ERROR';
  /** Unified user data (if valid = true) */
  unifiedUser?: UnifiedUser;
}

/**
 * Generate a one-time link token for cross-channel authentication
 *
 * Creates a cryptographically secure token with 10-minute TTL and stores it in the database.
 * The token can be used to authenticate the user on a different channel/interface.
 *
 * @param params - Token generation parameters
 * @returns Token, expiration, and full link URL
 * @throws Error if database operation fails
 *
 * @example
 * ```typescript
 * // Generate token for Telegram user to link web account
 * const result = await generateLinkToken({
 *   unifiedUserId: 'a1b2c3d4-...',
 *   sourceChannel: 'telegram'
 * });
 *
 * // Send link URL to user
 * console.log(result.linkUrl);
 * // => https://symancy.ru/link?token=abc123...
 * ```
 */
export async function generateLinkToken(
  params: GenerateLinkTokenParams
): Promise<LinkTokenResult> {
  const logger = getLogger().child({ module: 'link-token-service' });
  const supabase = getSupabase();
  const env = getEnv();

  const { unifiedUserId, sourceChannel } = params;

  // Generate cryptographically secure 32-byte token (64 hex characters)
  const token = randomBytes(32).toString('hex');

  // Token TTL: 10 minutes from now
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);

  logger.debug(
    { unifiedUserId, sourceChannel, expiresAt },
    'Generating link token'
  );

  // Insert token into database
  const { error } = await supabase.from('link_tokens').insert({
    unified_user_id: unifiedUserId,
    token: token,
    source_channel: sourceChannel,
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    logger.error({ error, unifiedUserId }, 'Failed to insert link token');
    throw new Error(`Failed to generate link token: ${error.message}`);
  }

  // Build full link URL
  const frontendUrl = env.FRONTEND_URL || 'https://symancy.ru';
  const linkUrl = `${frontendUrl}/link?token=${token}`;

  logger.info(
    {
      unifiedUserId,
      sourceChannel,
      expiresAt,
      tokenLength: token.length,
    },
    'Link token generated successfully'
  );

  return {
    token,
    expiresAt,
    linkUrl,
  };
}

/**
 * Validate and consume a link token
 *
 * Validates the token by:
 * 1. Finding it in the database
 * 2. Checking if it's not already used (used_at IS NULL)
 * 3. Checking if it's not expired (expires_at > now)
 * 4. Marking it as used (update used_at = now())
 * 5. Returning the unified user data
 *
 * The token can only be used once (single-use).
 *
 * @param token - The link token to validate and consume
 * @returns Validation result with user data or error reason
 *
 * @example
 * ```typescript
 * const result = await validateAndConsumeLinkToken('abc123...');
 *
 * if (result.valid) {
 *   console.log('User authenticated:', result.unifiedUser);
 * } else {
 *   console.error('Token invalid:', result.reason);
 * }
 * ```
 */
export async function validateAndConsumeLinkToken(
  token: string
): Promise<ValidateLinkTokenResult> {
  const logger = getLogger().child({ module: 'link-token-service' });
  const supabase = getSupabase();

  logger.debug({ tokenLength: token.length }, 'Validating link token');

  // Find token in database (unused tokens only)
  const { data: linkToken, error: fetchError } = await supabase
    .from('link_tokens')
    .select('*, unified_users(*)')
    .eq('token', token)
    .is('used_at', null)
    .single();

  if (fetchError) {
    // PGRST116 = no rows returned
    if (fetchError.code === 'PGRST116') {
      logger.warn({ tokenLength: token.length }, 'Token not found or already used');
      return {
        valid: false,
        reason: 'TOKEN_NOT_FOUND',
      };
    }

    logger.error({ error: fetchError }, 'Failed to fetch link token');
    return {
      valid: false,
      reason: 'DATABASE_ERROR',
    };
  }

  // Check if token is expired
  const now = new Date();
  const expiresAt = new Date(linkToken.expires_at);

  if (expiresAt < now) {
    logger.warn(
      {
        tokenId: linkToken.id,
        expiresAt,
        now,
      },
      'Token expired'
    );
    return {
      valid: false,
      reason: 'TOKEN_EXPIRED',
    };
  }

  // Mark token as used
  const { error: updateError } = await supabase
    .from('link_tokens')
    .update({ used_at: now.toISOString() })
    .eq('id', linkToken.id);

  if (updateError) {
    logger.error({ error: updateError, tokenId: linkToken.id }, 'Failed to mark token as used');
    return {
      valid: false,
      reason: 'DATABASE_ERROR',
    };
  }

  // Extract unified user from joined data
  const unifiedUser = linkToken.unified_users as unknown as UnifiedUser;

  logger.info(
    {
      tokenId: linkToken.id,
      unifiedUserId: unifiedUser.id,
      sourceChannel: linkToken.source_channel,
    },
    'Link token validated and consumed successfully'
  );

  return {
    valid: true,
    unifiedUser,
  };
}
