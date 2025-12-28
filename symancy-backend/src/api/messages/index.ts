/**
 * Messages Routes Registration
 *
 * Centralized registration point for all message-related endpoints.
 * Exports a single function to register all message routes with Fastify.
 *
 * @module api/messages
 */
import type { FastifyInstance } from 'fastify';
import { registerSendMessageRoute } from './send-message.js';

/**
 * Register all message routes
 *
 * Registers the following endpoints:
 * - POST /api/messages - Send a chat message
 *
 * @param fastify - Fastify instance
 *
 * @example
 * ```typescript
 * import { registerMessagesRoutes } from './api/messages/index.js';
 *
 * // In app.ts:
 * registerMessagesRoutes(fastify);
 * logger.info("Messages routes registered");
 * ```
 */
export function registerMessagesRoutes(fastify: FastifyInstance): void {
  registerSendMessageRoute(fastify);
}
