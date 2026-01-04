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
 * JSON Schema for PATCH /settings/timezone request body
 */
const updateTimezoneSchema = {
  body: {
    type: 'object' as const,
    required: ['timezone'],
    properties: {
      timezone: { type: 'string', maxLength: 50 },
    },
  },
};

/**
 * JSON Schema for PATCH /settings/notifications request body
 * All fields are optional for partial updates
 */
const updateNotificationSettingsSchema = {
  body: {
    type: 'object' as const,
    properties: {
      enabled: { type: 'boolean' },
      morning_enabled: { type: 'boolean' },
      evening_enabled: { type: 'boolean' },
      morning_time: { type: 'string', pattern: '^([01]\\d|2[0-3]):00$' },
      evening_time: { type: 'string', pattern: '^([01]\\d|2[0-3]):00$' },
    },
  },
};

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
  fastify.patch('/settings/timezone', { schema: updateTimezoneSchema }, updateTimezoneHandler);
  fastify.patch('/settings/notifications', { schema: updateNotificationSettingsSchema }, updateNotificationSettingsHandler);
}
