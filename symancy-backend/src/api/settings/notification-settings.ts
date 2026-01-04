/**
 * Notification Settings API
 *
 * Endpoints for managing user timezone and notification preferences.
 * Supports configuring when users receive daily insights (morning/evening).
 *
 * @module api/settings/notification-settings
 */
import type { FastifyRequest, FastifyReply } from 'fastify';
import { getSupabase } from '../../core/database.js';
import { verifyToken } from '../../services/auth/JwtService.js';
import { getLogger } from '../../core/logger.js';

const logger = getLogger().child({ module: 'settings' });

/**
 * Request body for updating timezone
 */
interface UpdateTimezoneBody {
  timezone: string;
}

/**
 * Request body for updating notification settings
 * All fields are optional for partial updates
 */
interface UpdateNotificationSettingsBody {
  enabled?: boolean;
  morning_enabled?: boolean;
  evening_enabled?: boolean;
  morning_time?: string; // "HH:00" format
  evening_time?: string; // "HH:00" format
}

/**
 * Notification settings structure stored in JSONB
 */
interface NotificationSettings {
  enabled: boolean;
  morning_enabled: boolean;
  evening_enabled: boolean;
  morning_time: string;
  evening_time: string;
}

/**
 * Response type for notification settings endpoints
 */
interface NotificationSettingsResponse {
  timezone: string;
  notification_settings: NotificationSettings;
}

/**
 * Default notification settings for new users
 */
const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  morning_enabled: true,
  evening_enabled: true,
  morning_time: '08:00',
  evening_time: '20:00',
};

/**
 * Regex for validating time format (HH:00, 00-23)
 */
const TIME_REGEX = /^([01]\d|2[0-3]):00$/;

/**
 * Validate timezone string using Intl API
 *
 * @param tz - Timezone string to validate (e.g., "Europe/Moscow")
 * @returns True if valid IANA timezone
 */
function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract and verify JWT from Authorization header
 *
 * @param request - Fastify request
 * @returns User ID or null if authentication fails
 */
function extractUserId(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);

  if (!payload?.sub) {
    return null;
  }

  return payload.sub;
}

/**
 * GET /api/settings/notifications
 *
 * Returns current timezone and notification settings for the authenticated user.
 *
 * @param request - Fastify request with Authorization header
 * @param reply - Fastify reply
 * @returns Current notification settings
 *
 * @example
 * ```typescript
 * // GET /api/settings/notifications
 * // Headers: { "Authorization": "Bearer <token>" }
 *
 * // Response 200:
 * {
 *   "timezone": "Europe/Moscow",
 *   "notification_settings": {
 *     "enabled": true,
 *     "morning_enabled": true,
 *     "evening_enabled": true,
 *     "morning_time": "08:00",
 *     "evening_time": "20:00"
 *   }
 * }
 * ```
 */
export async function getNotificationSettingsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<NotificationSettingsResponse | void> {
  // Authenticate user
  const userId = extractUserId(request);

  if (!userId) {
    return reply.status(401).send({
      error: 'UNAUTHORIZED',
      message: 'Missing or invalid authorization header',
    });
  }

  const supabase = getSupabase();

  logger.debug({ userId }, 'Fetching notification settings');

  // Fetch user settings from unified_users
  const { data: user, error } = await supabase
    .from('unified_users')
    .select('timezone, notification_settings')
    .eq('id', userId)
    .single();

  if (error) {
    logger.error({ error, userId }, 'Failed to fetch notification settings');
    return reply.status(500).send({
      error: 'INTERNAL_ERROR',
      message: 'Failed to fetch notification settings',
    });
  }

  if (!user) {
    return reply.status(404).send({
      error: 'NOT_FOUND',
      message: 'User not found',
    });
  }

  // Merge with defaults for any missing fields
  const settings: NotificationSettings = {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...(user.notification_settings as Partial<NotificationSettings> | null),
  };

  logger.debug({ userId, timezone: user.timezone }, 'Notification settings fetched');

  return reply.send({
    timezone: user.timezone || 'Europe/Moscow',
    notification_settings: settings,
  } satisfies NotificationSettingsResponse);
}

/**
 * PATCH /api/settings/timezone
 *
 * Updates the user's timezone for daily insight scheduling.
 *
 * @param request - Fastify request with timezone in body
 * @param reply - Fastify reply
 * @returns Success status and updated timezone
 *
 * @example
 * ```typescript
 * // PATCH /api/settings/timezone
 * // Headers: { "Authorization": "Bearer <token>" }
 * // Body: { "timezone": "Asia/Tokyo" }
 *
 * // Response 200:
 * { "success": true, "timezone": "Asia/Tokyo" }
 *
 * // Response 400 (invalid timezone):
 * { "error": "VALIDATION_ERROR", "message": "Invalid timezone" }
 * ```
 */
export async function updateTimezoneHandler(
  request: FastifyRequest<{ Body: UpdateTimezoneBody }>,
  reply: FastifyReply
): Promise<{ success: boolean; timezone: string } | void> {
  // Authenticate user
  const userId = extractUserId(request);

  if (!userId) {
    return reply.status(401).send({
      error: 'UNAUTHORIZED',
      message: 'Missing or invalid authorization header',
    });
  }

  const { timezone } = request.body || {};

  // Validate timezone is provided
  if (!timezone || typeof timezone !== 'string') {
    return reply.status(400).send({
      error: 'VALIDATION_ERROR',
      message: 'Timezone is required',
    });
  }

  // Validate timezone is valid IANA timezone
  if (!isValidTimezone(timezone)) {
    return reply.status(400).send({
      error: 'VALIDATION_ERROR',
      message: 'Invalid timezone. Must be a valid IANA timezone (e.g., "Europe/Moscow")',
    });
  }

  const supabase = getSupabase();

  logger.debug({ userId, timezone }, 'Updating timezone');

  // Update timezone in unified_users
  const { error } = await supabase
    .from('unified_users')
    .update({ timezone })
    .eq('id', userId);

  if (error) {
    logger.error({ error, userId, timezone }, 'Failed to update timezone');
    return reply.status(500).send({
      error: 'INTERNAL_ERROR',
      message: 'Failed to update timezone',
    });
  }

  logger.info({ userId, timezone }, 'Timezone updated');

  return reply.send({
    success: true,
    timezone,
  });
}

/**
 * PATCH /api/settings/notifications
 *
 * Updates notification settings with partial update support.
 * Only the fields provided in the request body will be updated.
 *
 * @param request - Fastify request with notification settings in body
 * @param reply - Fastify reply
 * @returns Success status and updated notification settings
 *
 * @example
 * ```typescript
 * // PATCH /api/settings/notifications
 * // Headers: { "Authorization": "Bearer <token>" }
 * // Body: { "morning_time": "09:00", "evening_enabled": false }
 *
 * // Response 200:
 * {
 *   "success": true,
 *   "notification_settings": {
 *     "enabled": true,
 *     "morning_enabled": true,
 *     "evening_enabled": false,
 *     "morning_time": "09:00",
 *     "evening_time": "20:00"
 *   }
 * }
 *
 * // Response 400 (invalid time format):
 * { "error": "VALIDATION_ERROR", "message": "Invalid morning_time format. Use HH:00 (e.g., '08:00')" }
 * ```
 */
export async function updateNotificationSettingsHandler(
  request: FastifyRequest<{ Body: UpdateNotificationSettingsBody }>,
  reply: FastifyReply
): Promise<{ success: boolean; notification_settings: NotificationSettings } | void> {
  // Authenticate user
  const userId = extractUserId(request);

  if (!userId) {
    return reply.status(401).send({
      error: 'UNAUTHORIZED',
      message: 'Missing or invalid authorization header',
    });
  }

  const body = request.body || {};

  // Validate time formats if provided
  if (body.morning_time !== undefined && !TIME_REGEX.test(body.morning_time)) {
    return reply.status(400).send({
      error: 'VALIDATION_ERROR',
      message: "Invalid morning_time format. Use HH:00 (e.g., '08:00')",
    });
  }

  if (body.evening_time !== undefined && !TIME_REGEX.test(body.evening_time)) {
    return reply.status(400).send({
      error: 'VALIDATION_ERROR',
      message: "Invalid evening_time format. Use HH:00 (e.g., '20:00')",
    });
  }

  // Validate boolean types if provided
  if (body.enabled !== undefined && typeof body.enabled !== 'boolean') {
    return reply.status(400).send({
      error: 'VALIDATION_ERROR',
      message: 'enabled must be a boolean',
    });
  }

  if (body.morning_enabled !== undefined && typeof body.morning_enabled !== 'boolean') {
    return reply.status(400).send({
      error: 'VALIDATION_ERROR',
      message: 'morning_enabled must be a boolean',
    });
  }

  if (body.evening_enabled !== undefined && typeof body.evening_enabled !== 'boolean') {
    return reply.status(400).send({
      error: 'VALIDATION_ERROR',
      message: 'evening_enabled must be a boolean',
    });
  }

  const supabase = getSupabase();

  logger.debug({ userId, updates: body }, 'Updating notification settings');

  // Fetch current settings first
  const { data: user, error: fetchError } = await supabase
    .from('unified_users')
    .select('notification_settings')
    .eq('id', userId)
    .single();

  if (fetchError) {
    logger.error({ error: fetchError, userId }, 'Failed to fetch current notification settings');
    return reply.status(500).send({
      error: 'INTERNAL_ERROR',
      message: 'Failed to fetch current settings',
    });
  }

  // Merge current settings with defaults, then with updates
  const currentSettings: NotificationSettings = {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...(user?.notification_settings as Partial<NotificationSettings> | null),
  };

  // Build update object with only the fields that were provided
  const updates: Partial<NotificationSettings> = {};
  if (body.enabled !== undefined) updates.enabled = body.enabled;
  if (body.morning_enabled !== undefined) updates.morning_enabled = body.morning_enabled;
  if (body.evening_enabled !== undefined) updates.evening_enabled = body.evening_enabled;
  if (body.morning_time !== undefined) updates.morning_time = body.morning_time;
  if (body.evening_time !== undefined) updates.evening_time = body.evening_time;

  const newSettings: NotificationSettings = {
    ...currentSettings,
    ...updates,
  };

  // Update notification_settings in unified_users
  const { error: updateError } = await supabase
    .from('unified_users')
    .update({ notification_settings: newSettings })
    .eq('id', userId);

  if (updateError) {
    logger.error({ error: updateError, userId }, 'Failed to update notification settings');
    return reply.status(500).send({
      error: 'INTERNAL_ERROR',
      message: 'Failed to update notification settings',
    });
  }

  logger.info({ userId, notification_settings: newSettings }, 'Notification settings updated');

  return reply.send({
    success: true,
    notification_settings: newSettings,
  });
}
