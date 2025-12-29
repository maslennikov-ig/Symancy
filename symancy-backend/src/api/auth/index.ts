/**
 * Auth Routes Registration
 *
 * Centralized registration point for all authentication endpoints.
 * Exports a single function to register all auth routes with Fastify.
 *
 * @module api/auth
 */
import type { FastifyInstance } from 'fastify';
import { registerTelegramLoginRoute } from './telegram-login.js';
import { registerMeRoute } from './me.js';
import { registerWebappAuthRoute } from './webapp-auth.js';
import { registerLinkTokenRoute } from './link-token.js';
import { registerLinkRoute } from './link.js';

/**
 * Register all authentication routes
 *
 * Registers the following endpoints (nginx adds /api prefix):
 * - POST /auth/telegram - Telegram Login Widget authentication
 * - POST /auth/webapp - Telegram WebApp authentication
 * - GET /auth/me - Get current authenticated user
 * - POST /auth/link-token - Generate link token for account linking
 * - POST /auth/link - Link Telegram account to web account
 *
 * @param fastify - Fastify instance
 *
 * @example
 * ```typescript
 * import { registerAuthRoutes } from './api/auth/index.js';
 *
 * // In app.ts:
 * registerAuthRoutes(fastify);
 * logger.info("Auth routes registered");
 * ```
 */
export function registerAuthRoutes(fastify: FastifyInstance): void {
  registerTelegramLoginRoute(fastify);
  registerWebappAuthRoute(fastify);
  registerMeRoute(fastify);
  registerLinkTokenRoute(fastify);
  registerLinkRoute(fastify);
}
