/**
 * Telegram WebApp Authentication Endpoint
 *
 * Handles POST /api/auth/webapp for Telegram WebApp authentication.
 * Verifies WebApp initData, finds or creates user, and returns JWT token.
 *
 * @module api/auth/webapp-auth
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { verifyWebAppInitData } from '../../services/auth/TelegramAuthService.js';
import { createTelegramUserToken } from '../../services/auth/JwtService.js';
import { findOrCreateByTelegramId } from '../../services/user/UnifiedUserService.js';
import { type LanguageCode } from '../../types/omnichannel.js';
import { getLogger } from '../../core/logger.js';
import { z } from 'zod';

const logger = getLogger().child({ module: 'webapp-auth' });

/**
 * Extract language code from WebApp user data and request headers
 *
 * Priority:
 * 1. Telegram WebApp user data (language_code field if present)
 * 2. Accept-Language header from browser
 * 3. Default to 'ru'
 *
 * @param webAppUser - WebApp user data from initData (may contain language_code)
 * @param request - Fastify request (for Accept-Language header)
 * @returns Supported language code ('ru', 'en', or 'zh')
 */
function extractLanguageCode(
  webAppUser: { language_code?: string },
  request: FastifyRequest
): LanguageCode {
  // 1. Try from Telegram WebApp user data
  if (webAppUser.language_code && typeof webAppUser.language_code === 'string') {
    const lang = webAppUser.language_code.toLowerCase().split('-')[0];
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
 * WebApp auth request body schema
 */
const WebAppAuthBodySchema = z.object({
  /** Raw initData string from Telegram.WebApp.initData */
  init_data: z.string().min(1, 'init_data is required'),
});

/**
 * WebApp auth request body type
 */
type WebAppAuthBody = z.infer<typeof WebAppAuthBodySchema>;

/**
 * Handle Telegram WebApp authentication
 *
 * Workflow:
 * 1. Validate request body (init_data present)
 * 2. Verify WebApp initData using TelegramAuthService
 * 3. Extract user data from verified initData
 * 4. Find or create unified user using UnifiedUserService
 * 5. Create JWT token using JwtService
 * 6. Return AuthResponse (user + token + expires_at)
 *
 * @param request - Fastify request with WebAppAuthBody
 * @param reply - Fastify reply
 * @returns AuthResponse with user, token, and expiration
 *
 * @example
 * ```typescript
 * // POST /api/auth/webapp
 * // Body:
 * {
 *   "init_data": "query_id=...&user=%7B%22id%22%3A123456789...&auth_date=...&hash=..."
 * }
 *
 * // Response 200:
 * {
 *   "user": { id: "uuid...", telegram_id: 123456789, ... },
 *   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *   "expires_at": "2025-01-04T12:00:00.000Z"
 * }
 *
 * // Response 400 (missing init_data):
 * {
 *   "error": "INVALID_REQUEST",
 *   "message": "Missing or invalid init_data"
 * }
 *
 * // Response 401 (invalid signature):
 * {
 *   "error": "INVALID_SIGNATURE",
 *   "message": "WebApp authentication failed: Invalid signature"
 * }
 *
 * // Response 401 (no user data):
 * {
 *   "error": "NO_USER_DATA",
 *   "message": "WebApp authentication failed: No user data in initData"
 * }
 * ```
 */
export async function webappAuthHandler(
  request: FastifyRequest<{ Body: WebAppAuthBody }>,
  reply: FastifyReply
) {
  const body = request.body;

  // Validate request body using Zod schema
  const parseResult = WebAppAuthBodySchema.safeParse(body);
  if (!parseResult.success) {
    logger.warn({ errors: parseResult.error.flatten() }, 'Invalid WebApp auth request');
    return reply.status(400).send({
      error: 'INVALID_REQUEST',
      message: 'Missing or invalid init_data',
      ...(process.env.NODE_ENV === 'development' && {
        details: parseResult.error.flatten(),
      }),
    });
  }

  const { init_data } = parseResult.data;

  // Verify WebApp initData signature
  const verification = verifyWebAppInitData(init_data);
  if (!verification.valid) {
    logger.warn(
      { reason: verification.reason },
      'WebApp auth verification failed'
    );

    const errorCode = verification.reason?.includes('expired')
      ? 'AUTH_EXPIRED'
      : 'INVALID_SIGNATURE';

    return reply.status(401).send({
      error: errorCode,
      message: 'WebApp authentication failed: ' + verification.reason,
    });
  }

  // Ensure user data is present
  if (!verification.user) {
    logger.warn('WebApp auth failed: no user data in initData');
    return reply.status(401).send({
      error: 'NO_USER_DATA',
      message: 'WebApp authentication failed: No user data in initData',
    });
  }

  const { user: webAppUser } = verification;

  try {
    // Find or create user in database
    const displayName = [webAppUser.first_name, webAppUser.last_name]
      .filter(Boolean)
      .join(' ');

    const languageCode = extractLanguageCode(webAppUser, request);

    const unifiedUser = await findOrCreateByTelegramId({
      telegramId: webAppUser.id,
      displayName,
      languageCode,
    });

    // Create JWT token (valid for 7 days by default)
    const { token, expiresAt } = createTelegramUserToken(unifiedUser.id, webAppUser.id);

    logger.info(
      { userId: unifiedUser.id, telegramId: webAppUser.id },
      'WebApp login successful'
    );

    // Return AuthResponse
    return reply.send({
      user: unifiedUser,
      token,
      expires_at: expiresAt.toISOString(),
    });
  } catch (error) {
    logger.error({ error, telegramId: webAppUser.id }, 'WebApp login failed');

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
 * Register the WebApp Auth route with Fastify
 *
 * Registers POST /api/auth/webapp endpoint.
 *
 * @param fastify - Fastify instance
 */
export function registerWebappAuthRoute(fastify: FastifyInstance) {
  fastify.post('/api/auth/webapp', webappAuthHandler);
}
