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
 * Validate and consume a link token atomically
 *
 * Uses PostgreSQL function `consume_link_token` to atomically:
 * 1. Find the token in the database
 * 2. Check if it's not already used (used_at IS NULL)
 * 3. Check if it's not expired (expires_at > now)
 * 4. Mark it as used (update used_at = now())
 * 5. Return the unified user data
 *
 * This atomic approach prevents race conditions where two requests
 * could consume the same token simultaneously.
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

  // Use atomic RPC call to prevent race conditions
  // The function atomically checks validity and marks as used in one operation
  const { data, error } = await supabase.rpc('consume_link_token', {
    token_value: token,
  });

  if (error) {
    logger.error({ error }, 'Failed to consume link token');
    return {
      valid: false,
      reason: 'DATABASE_ERROR',
    };
  }

  // No rows returned means token not found, expired, or already used
  if (!data || data.length === 0) {
    logger.warn({ tokenLength: token.length }, 'Token not found, expired, or already used');
    return {
      valid: false,
      reason: 'TOKEN_NOT_FOUND',
    };
  }

  const tokenData = data[0];

  // Reconstruct unified user from joined data returned by the function
  const unifiedUser: UnifiedUser = {
    id: tokenData.user_id,
    telegram_id: tokenData.user_telegram_id,
    auth_id: tokenData.user_auth_id,
    whatsapp_phone: tokenData.user_whatsapp_phone,
    wechat_openid: tokenData.user_wechat_openid,
    display_name: tokenData.user_display_name,
    avatar_url: tokenData.user_avatar_url,
    language_code: tokenData.user_language_code,
    timezone: tokenData.user_timezone,
    is_telegram_linked: tokenData.user_is_telegram_linked,
    onboarding_completed: tokenData.user_onboarding_completed,
    is_banned: tokenData.user_is_banned,
    primary_interface: tokenData.user_primary_interface,
    notification_settings: tokenData.user_notification_settings ?? {},
    created_at: tokenData.user_created_at,
    updated_at: tokenData.user_updated_at,
    last_active_at: tokenData.user_last_active_at,
  };

  logger.info(
    {
      tokenId: tokenData.id,
      unifiedUserId: unifiedUser.id,
      sourceChannel: tokenData.source_channel,
    },
    'Link token validated and consumed atomically'
  );

  return {
    valid: true,
    unifiedUser,
  };
}

/**
 * Clean up expired link tokens
 *
 * Deletes tokens that expired more than 24 hours ago.
 * Should be called periodically via scheduled job.
 *
 * @returns Number of deleted tokens
 *
 * @example
 * ```typescript
 * // Run cleanup job
 * const deletedCount = await cleanupExpiredLinkTokens();
 * console.log(`Cleaned up ${deletedCount} expired tokens`);
 * ```
 */
export async function cleanupExpiredLinkTokens(): Promise<number> {
  const logger = getLogger().child({ module: 'link-token-cleanup' });
  const supabase = getSupabase();

  // Delete tokens expired more than 24 hours ago
  const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from('link_tokens')
    .delete()
    .lt('expires_at', cutoffDate.toISOString())
    .select('id');

  if (error) {
    logger.error({ error }, 'Failed to cleanup expired link tokens');
    return 0;
  }

  const deletedCount = data?.length || 0;

  if (deletedCount > 0) {
    logger.info(
      { deletedCount, cutoffDate: cutoffDate.toISOString() },
      'Expired link tokens cleaned up'
    );
  }

  return deletedCount;
}
