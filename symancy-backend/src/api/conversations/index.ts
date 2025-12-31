/**
 * Conversations Routes Registration
 *
 * Centralized registration point for all conversation-related endpoints.
 * Exports a single function to register all conversation routes with Fastify.
 *
 * @module api/conversations
 */
import type { FastifyInstance } from 'fastify';
import { registerCreateConversationRoute } from './create-conversation.js';

/**
 * Register all conversation routes
 *
 * Registers the following endpoints:
 * - POST /api/conversations - Create or get active conversation
 *
 * @param fastify - Fastify instance
 *
 * @example
 * ```typescript
 * import { registerConversationsRoutes } from './api/conversations/index.js';
 *
 * // In app.ts:
 * registerConversationsRoutes(fastify);
 * logger.info("Conversations routes registered");
 * ```
 */
export function registerConversationsRoutes(fastify: FastifyInstance): void {
  registerCreateConversationRoute(fastify);
}
