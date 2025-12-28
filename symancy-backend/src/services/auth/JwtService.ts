/**
 * JWT Service for Telegram-authenticated users
 *
 * Creates custom JWTs that Supabase RLS will accept.
 * Uses HS256 algorithm with SUPABASE_JWT_SECRET for signing.
 *
 * @module services/auth/JwtService
 */
import jwt from 'jsonwebtoken';
import { getEnv } from '../../config/env.js';
import { getLogger } from '../../core/logger.js';

/**
 * Custom JWT payload for Telegram-authenticated users
 *
 * Structure follows Supabase JWT standard with additional Telegram metadata
 */
export interface TelegramJwtPayload {
  /** unified_users.id (Supabase user identifier) */
  sub: string;
  /** Telegram user ID (for logging/debugging) */
  telegram_id: number;
  /** Supabase standard role (required for RLS) */
  role: 'authenticated';
  /** Issued at (Unix timestamp in seconds) */
  iat: number;
  /** Expiration (Unix timestamp in seconds) */
  exp: number;
}

/**
 * Token creation result
 */
export interface TokenResult {
  /** JWT token string */
  token: string;
  /** Token expiration date */
  expiresAt: Date;
}

/**
 * Create a JWT token for a Telegram-authenticated user
 *
 * The token is signed with SUPABASE_JWT_SECRET and includes:
 * - sub: unified_users.id (Supabase will use this for RLS)
 * - role: 'authenticated' (grants access to authenticated-only tables)
 * - telegram_id: Original Telegram ID (for logging/debugging)
 *
 * @param unifiedUserId - UUID from unified_users.id
 * @param telegramId - Telegram user ID from auth data
 * @param expiresInHours - Token validity duration (default: 7 days)
 * @returns Token string and expiration date
 *
 * @example
 * ```typescript
 * const { token, expiresAt } = createTelegramUserToken(
 *   'a1b2c3d4-...',
 *   123456789,
 *   24 * 7 // 7 days
 * );
 * ```
 */
export function createTelegramUserToken(
  unifiedUserId: string,
  telegramId: number,
  expiresInHours: number = 24 * 7 // 7 days default
): TokenResult {
  const env = getEnv();
  const logger = getLogger().child({ module: 'jwt' });

  const now = Math.floor(Date.now() / 1000);
  const exp = now + expiresInHours * 3600;

  const payload: TelegramJwtPayload = {
    sub: unifiedUserId,
    telegram_id: telegramId,
    role: 'authenticated',
    iat: now,
    exp: exp,
  };

  const token = jwt.sign(payload, env.SUPABASE_JWT_SECRET, {
    algorithm: 'HS256',
  });

  logger.debug({ telegramId, unifiedUserId, exp }, 'Created JWT for Telegram user');

  return {
    token,
    expiresAt: new Date(exp * 1000),
  };
}

/**
 * Verify and decode a JWT token
 *
 * Validates the token signature using SUPABASE_JWT_SECRET.
 * Returns null if verification fails (invalid signature, expired, malformed).
 *
 * @param token - JWT token string to verify
 * @returns Decoded payload or null if verification fails
 *
 * @example
 * ```typescript
 * const payload = verifyToken(token);
 * if (payload) {
 *   console.log('Valid token for user:', payload.sub);
 * } else {
 *   console.log('Invalid or expired token');
 * }
 * ```
 */
export function verifyToken(token: string): TelegramJwtPayload | null {
  const env = getEnv();
  const logger = getLogger().child({ module: 'jwt' });

  try {
    return jwt.verify(token, env.SUPABASE_JWT_SECRET) as TelegramJwtPayload;
  } catch (error) {
    logger.warn({ error }, 'JWT verification failed');
    return null;
  }
}
