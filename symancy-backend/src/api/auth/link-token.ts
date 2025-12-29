/**
 * Link Token Generation Endpoint
 *
 * Handles POST /api/auth/link-token for generating one-time link tokens.
 * Requires Bearer authentication. Used to link Telegram account to web account.
 *
 * @module api/auth/link-token
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken } from '../../services/auth/JwtService.js';
import { generateLinkToken } from '../../services/auth/LinkTokenService.js';
import { getLogger } from '../../core/logger.js';
import { getSupabase } from '../../core/database.js';
import { extractBearerToken } from '../../utils/auth.js';

const logger = getLogger().child({ module: 'link-token' });

/**
 * Handle POST /api/auth/link-token request
 *
 * Workflow:
 * 1. Extract JWT from Authorization header (Bearer token)
 * 2. Verify token using JwtService
 * 3. Generate link token using LinkTokenService
 * 4. Return token, expires_at, and link_url
 *
 * @param request - Fastify request with Authorization header
 * @param reply - Fastify reply
 * @returns Link token data or error response
 *
 * @example
 * ```typescript
 * // POST /api/auth/link-token
 * // Headers:
 * {
 *   "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 * }
 *
 * // Response 200:
 * {
 *   "token": "abc123...def456...",
 *   "expires_at": "2025-12-28T12:10:00.000Z",
 *   "link_url": "https://symancy.ru/link?token=abc123...def456..."
 * }
 *
 * // Response 401 (missing header):
 * {
 *   "error": "UNAUTHORIZED",
 *   "message": "Missing or invalid authorization header"
 * }
 *
 * // Response 401 (invalid token):
 * {
 *   "error": "UNAUTHORIZED",
 *   "message": "Invalid or expired token"
 * }
 * ```
 */
export async function linkTokenHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Extract Authorization header
  const authHeader = request.headers.authorization;
  const token = extractBearerToken(authHeader);

  if (!token) {
    return reply.status(401).send({
      error: 'UNAUTHORIZED',
      message: 'Missing or invalid authorization header',
    });
  }

  // Verify JWT token
  const payload = verifyToken(token);

  if (!payload) {
    return reply.status(401).send({
      error: 'UNAUTHORIZED',
      message: 'Invalid or expired token',
    });
  }

  // Verify user exists in unified_users
  const supabase = getSupabase();

  const { data: user, error: userError } = await supabase
    .from('unified_users')
    .select('id')
    .eq('id', payload.sub)
    .single();

  if (userError || !user) {
    logger.warn({ userId: payload.sub }, 'User not found for valid JWT');
    return reply.status(404).send({
      error: 'USER_NOT_FOUND',
      message: 'User account not found',
    });
  }

  // Generate link token
  try {
    const linkTokenResult = await generateLinkToken({
      unifiedUserId: payload.sub,
      sourceChannel: 'telegram', // Telegram user wants to link to web
    });

    logger.info(
      { userId: payload.sub, expiresAt: linkTokenResult.expiresAt },
      'Link token generated successfully'
    );

    return reply.send({
      token: linkTokenResult.token,
      expires_at: linkTokenResult.expiresAt.toISOString(),
      link_url: linkTokenResult.linkUrl,
    });
  } catch (error) {
    logger.error({ error, userId: payload.sub }, 'Failed to generate link token');
    return reply.status(500).send({
      error: 'INTERNAL_ERROR',
      message: 'Failed to generate link token',
    });
  }
}

/**
 * Register the link token route with Fastify
 *
 * Registers POST /api/auth/link-token endpoint.
 *
 * @param fastify - Fastify instance
 */
export function registerLinkTokenRoute(fastify: FastifyInstance) {
  fastify.post('/auth/link-token', linkTokenHandler);
}
