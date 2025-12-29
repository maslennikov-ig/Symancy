/**
 * Get Current User Endpoint
 *
 * Handles GET /api/auth/me for retrieving the current authenticated user.
 * Extracts JWT from Authorization header, verifies it, and returns user data.
 *
 * @module api/auth/me
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken } from '../../services/auth/JwtService.js';
import { getUserById } from '../../services/user/UnifiedUserService.js';
import { getLogger } from '../../core/logger.js';

const logger = getLogger().child({ module: 'auth' });

/**
 * Handle GET /api/auth/me request
 *
 * Workflow:
 * 1. Extract JWT from Authorization header (Bearer token)
 * 2. Verify token using JwtService
 * 3. Get user by ID using UnifiedUserService
 * 4. Return the user or error
 *
 * @param request - Fastify request with Authorization header
 * @param reply - Fastify reply
 * @returns User object or error response
 *
 * @example
 * ```typescript
 * // GET /api/auth/me
 * // Headers:
 * {
 *   "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 * }
 *
 * // Response 200:
 * {
 *   "user": {
 *     "id": "uuid...",
 *     "telegram_id": 123456789,
 *     "display_name": "John Doe",
 *     "language_code": "ru",
 *     ...
 *   }
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
 *
 * // Response 404 (user not found):
 * {
 *   "error": "USER_NOT_FOUND",
 *   "message": "User not found"
 * }
 * ```
 */
export async function meHandler(request: FastifyRequest, reply: FastifyReply) {
  // Extract Authorization header
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({
      error: 'UNAUTHORIZED',
      message: 'Missing or invalid authorization header',
    });
  }

  // Extract token (remove "Bearer " prefix)
  const token = authHeader.slice(7);

  // Verify JWT token
  const payload = verifyToken(token);

  if (!payload) {
    return reply.status(401).send({
      error: 'UNAUTHORIZED',
      message: 'Invalid or expired token',
    });
  }

  // Get user from database
  const user = await getUserById(payload.sub);

  if (!user) {
    logger.warn({ userId: payload.sub }, 'User not found for valid token');
    return reply.status(404).send({
      error: 'USER_NOT_FOUND',
      message: 'User not found',
    });
  }

  return reply.send({ user });
}

/**
 * Register the /me route with Fastify
 *
 * Registers GET /api/auth/me endpoint.
 *
 * @param fastify - Fastify instance
 */
export function registerMeRoute(fastify: FastifyInstance) {
  fastify.get('/auth/me', meHandler);
}
