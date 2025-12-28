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

/**
 * Register all authentication routes
 *
 * Registers the following endpoints:
 * - POST /api/auth/telegram - Telegram Login Widget authentication
 * - POST /api/auth/webapp - Telegram WebApp authentication
 * - GET /api/auth/me - Get current authenticated user
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
}
