/**
 * Telegram Login Endpoint
 *
 * Handles POST /api/auth/telegram for Telegram Login Widget authentication.
 * Verifies signature, finds or creates user, and returns JWT token.
 *
 * @module api/auth/telegram-login
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { verifyTelegramAuth } from '../../services/auth/TelegramAuthService.js';
import { createTelegramUserToken } from '../../services/auth/JwtService.js';
import { findOrCreateByTelegramId } from '../../services/user/UnifiedUserService.js';
import { TelegramAuthDataSchema, type LanguageCode } from '../../types/omnichannel.js';
import { getLogger } from '../../core/logger.js';

const logger = getLogger().child({ module: 'auth' });

/**
 * Extract language code from auth data and request headers
 *
 * Priority:
 * 1. Telegram auth data (language_code field if present)
 * 2. Accept-Language header from browser
 * 3. Default to 'ru'
 *
 * @param body - Request body (may contain language_code)
 * @param request - Fastify request (for Accept-Language header)
 * @returns Supported language code ('ru', 'en', or 'zh')
 */
function extractLanguageCode(body: { language_code?: string }, request: FastifyRequest): LanguageCode {
  // 1. Try from Telegram auth data (Telegram Login Widget may provide this)
  if (body.language_code && typeof body.language_code === 'string') {
    const lang = body.language_code.toLowerCase().split('-')[0];
    if (lang && ['ru', 'en', 'zh'].includes(lang)) {
      return lang as LanguageCode;
    }
  }

  // 2. Try from Accept-Language header
  const acceptLanguage = request.headers['accept-language'];
  if (acceptLanguage) {
    const lang = acceptLanguage.split(',')[0]?.split('-')[0]?.toLowerCase();
    if (lang && ['ru', 'en', 'zh'].includes(lang)) {
      return lang as LanguageCode;
    }
  }

  // 3. Default to Russian
  return 'ru';
}

/**
 * Telegram Login Widget request body
 *
 * Matches the data sent by Telegram Login Widget when user authenticates.
 */
interface TelegramLoginBody {
  /** Telegram user ID */
  id: number;
  /** User's first name */
  first_name: string;
  /** User's last name (optional) */
  last_name?: string;
  /** User's username (optional) */
  username?: string;
  /** User's profile photo URL (optional) */
  photo_url?: string;
  /** User's language code (optional, e.g., 'ru', 'en') */
  language_code?: string;
  /** Unix timestamp when authentication occurred */
  auth_date: number;
  /** HMAC-SHA256 signature for verification */
  hash: string;
}

/**
 * Handle Telegram Login Widget authentication
 *
 * Workflow:
 * 1. Validate request body with Zod schema
 * 2. Verify Telegram signature using TelegramAuthService
 * 3. Find or create unified user using UnifiedUserService
 * 4. Create JWT token using JwtService
 * 5. Return AuthResponse (user + token + expires_at)
 *
 * @param request - Fastify request with TelegramLoginBody
 * @param reply - Fastify reply
 * @returns AuthResponse with user, token, and expiration
 *
 * @example
 * ```typescript
 * // POST /api/auth/telegram
 * // Body:
 * {
 *   "id": 123456789,
 *   "first_name": "John",
 *   "last_name": "Doe",
 *   "username": "johndoe",
 *   "auth_date": 1703980800,
 *   "hash": "abc123..."
 * }
 *
 * // Response 200:
 * {
 *   "user": { id: "uuid...", telegram_id: 123456789, ... },
 *   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *   "expires_at": "2025-01-04T12:00:00.000Z"
 * }
 *
 * // Response 400 (invalid data):
 * {
 *   "error": "INVALID_REQUEST",
 *   "message": "Invalid Telegram auth data",
 *   "details": { ... }
 * }
 *
 * // Response 401 (invalid signature):
 * {
 *   "error": "INVALID_SIGNATURE",
 *   "message": "Telegram authentication failed: invalid signature"
 * }
 *
 * // Response 401 (expired):
 * {
 *   "error": "AUTH_EXPIRED",
 *   "message": "Telegram authentication failed: expired"
 * }
 * ```
 */
export async function telegramLoginHandler(
  request: FastifyRequest<{ Body: TelegramLoginBody }>,
  reply: FastifyReply
) {
  const body = request.body;

  // Validate request body using Zod schema
  const parseResult = TelegramAuthDataSchema.safeParse(body);
  if (!parseResult.success) {
    return reply.status(400).send({
      error: 'INVALID_REQUEST',
      message: 'Invalid Telegram auth data',
      details: parseResult.error.flatten(),
    });
  }

  // Verify Telegram signature using HMAC-SHA256
  const verification = verifyTelegramAuth(body);
  if (!verification.valid) {
    logger.warn(
      { telegramId: body.id, reason: verification.reason },
      'Telegram auth verification failed'
    );
    return reply.status(401).send({
      error: verification.reason === 'Authentication data expired (24 hours old)' ||
             verification.reason?.includes('expired') ? 'AUTH_EXPIRED' : 'INVALID_SIGNATURE',
      message: 'Telegram authentication failed: ' + verification.reason,
    });
  }

  try {
    // Find or create user in database
    const displayName = [body.first_name, body.last_name].filter(Boolean).join(' ');
    const languageCode = extractLanguageCode(body, request);

    const user = await findOrCreateByTelegramId({
      telegramId: body.id,
      displayName,
      languageCode,
    });

    // Create JWT token (valid for 7 days by default)
    const { token, expiresAt } = createTelegramUserToken(user.id, body.id);

    logger.info({ userId: user.id, telegramId: body.id }, 'Telegram login successful');

    // Return AuthResponse
    return reply.send({
      user,
      token,
      expires_at: expiresAt.toISOString(),
    });
  } catch (error) {
    logger.error({ error, telegramId: body.id }, 'Telegram login failed');

    return reply.status(500).send({
      error: 'INTERNAL_ERROR',
      message: 'Authentication failed due to server error',
      ...(process.env.NODE_ENV === 'development' && {
        details: error instanceof Error ? error.message : String(error),
      }),
    });
  }
}

/**
 * Register the Telegram Login route with Fastify
 *
 * Registers POST /api/auth/telegram endpoint.
 *
 * @param fastify - Fastify instance
 */
export function registerTelegramLoginRoute(fastify: FastifyInstance) {
  fastify.post('/api/auth/telegram', telegramLoginHandler);
}
