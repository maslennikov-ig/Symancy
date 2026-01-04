/**
 * Settings Routes Registration
 *
 * Centralized registration point for all settings-related endpoints.
 * Exports a single function to register all settings routes with Fastify.
 *
 * @module api/settings
 */
import type { FastifyInstance } from 'fastify';
import {
  getNotificationSettingsHandler,
  updateTimezoneHandler,
  updateNotificationSettingsHandler,
} from './notification-settings.js';

/**
 * Register all settings routes
 *
 * Registers the following endpoints:
 * - GET /api/settings/notifications - Get current timezone and notification settings
 * - PATCH /api/settings/timezone - Update user timezone
 * - PATCH /api/settings/notifications - Update notification settings (partial update)
 *
 * @param fastify - Fastify instance
 *
 * @example
 * ```typescript
 * import { registerSettingsRoutes } from './api/settings/index.js';
 *
 * // In app.ts:
 * registerSettingsRoutes(fastify);
 * logger.info("Settings routes registered");
 * ```
 */
export function registerSettingsRoutes(fastify: FastifyInstance): void {
  fastify.get('/settings/notifications', getNotificationSettingsHandler);
  fastify.patch('/settings/timezone', updateTimezoneHandler);
  fastify.patch('/settings/notifications', updateNotificationSettingsHandler);
}
