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
 * Generic JWT payload that works for both Telegram and Supabase Auth tokens
 *
 * - Telegram tokens have telegram_id
 * - Supabase Auth tokens have sub = auth.users.id (no telegram_id)
 */
export interface GenericJwtPayload {
  /** User identifier (unified_users.id for Telegram, auth.users.id for web) */
  sub: string;
  /** Telegram user ID (only present in Telegram tokens) */
  telegram_id?: number;
  /** Supabase standard role */
  role: 'authenticated' | 'anon' | 'service_role';
  /** Issued at (Unix timestamp in seconds) */
  iat: number;
  /** Expiration (Unix timestamp in seconds) */
  exp: number;
  /** Email (present in Supabase Auth tokens) */
  email?: string;
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
 * Works for both Telegram custom tokens and Supabase Auth session tokens.
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
 *   if (payload.telegram_id) {
 *     console.log('Telegram user');
 *   } else {
 *     console.log('Web user (Supabase Auth)');
 *   }
 * } else {
 *   console.log('Invalid or expired token');
 * }
 * ```
 */
export function verifyToken(token: string): GenericJwtPayload | null {
  const env = getEnv();
  const logger = getLogger().child({ module: 'jwt' });

  try {
    // SECURITY: Explicitly restrict to HS256 algorithm only
    // This prevents algorithm confusion attacks (CVE-worthy vulnerability)
    return jwt.verify(token, env.SUPABASE_JWT_SECRET, {
      algorithms: ['HS256'],
    }) as GenericJwtPayload;
  } catch (error) {
    logger.warn({ error }, 'JWT verification failed');
    return null;
  }
}

/**
 * Check if a JWT payload is from a Telegram user
 *
 * @param payload - JWT payload
 * @returns True if the token is from a Telegram-authenticated user
 */
export function isTelegramToken(payload: GenericJwtPayload): payload is TelegramJwtPayload {
  return typeof payload.telegram_id === 'number';
}
