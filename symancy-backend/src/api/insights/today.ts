/**
 * Get Today's Insight Endpoint
 *
 * Handles GET /api/insights/today for retrieving the current day's
 * personalized insight (morning advice or evening insight).
 *
 * Returns morning advice during the day, switches to evening insight
 * after 20:00 (if available).
 *
 * @module api/insights/today
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getSupabase } from '../../core/database.js';
import { verifyToken } from '../../services/auth/JwtService.js';
import { getLogger } from '../../core/logger.js';

const logger = getLogger().child({ module: 'insights' });

/**
 * Response interface for today's insight endpoint
 */
interface TodayInsightResponse {
  /** Whether an insight exists for today */
  hasInsight: boolean;
  /** Type of insight: morning or evening */
  type: 'morning' | 'evening' | null;
  /** Full insight content */
  content: string | null;
  /** Short teaser/preview (first ~100 chars) */
  shortContent: string | null;
}

/**
 * Database row structure for daily_insights table
 */
interface DailyInsightRow {
  morning_advice: string | null;
  morning_advice_short: string | null;
  evening_insight: string | null;
  evening_insight_short: string | null;
}

/**
 * Handle GET /api/insights/today request
 *
 * Workflow:
 * 1. Extract and verify JWT from Authorization header
 * 2. Query today's insight for the authenticated user
 * 3. Return appropriate insight based on time of day:
 *    - After 20:00: evening insight (if available), else morning
 *    - Before 20:00: morning advice (if available)
 *
 * @param request - Fastify request with Authorization header
 * @param reply - Fastify reply
 * @returns Today's insight or empty response
 *
 * @example
 * ```typescript
 * // GET /api/insights/today
 * // Headers:
 * {
 *   "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 * }
 *
 * // Response 200 (insight exists):
 * {
 *   "hasInsight": true,
 *   "type": "morning",
 *   "content": "Today is a great day to focus on...",
 *   "shortContent": "Today is a great day to focus on..."
 * }
 *
 * // Response 200 (no insight):
 * {
 *   "hasInsight": false,
 *   "type": null,
 *   "content": null,
 *   "shortContent": null
 * }
 *
 * // Response 401 (unauthorized):
 * {
 *   "error": "UNAUTHORIZED",
 *   "message": "Missing or invalid authorization header"
 * }
 * ```
 */
export async function todayInsightHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<TodayInsightResponse | void> {
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

  if (!payload || !payload.sub) {
    return reply.status(401).send({
      error: 'UNAUTHORIZED',
      message: 'Invalid or expired token',
    });
  }

  const userId = payload.sub;
  const supabase = getSupabase();

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];
  const currentHour = new Date().getHours();

  logger.debug({ userId, today, currentHour }, 'Fetching today insight');

  // Query today's insight for the user
  const { data: insight, error } = await supabase
    .from('daily_insights')
    .select('morning_advice, morning_advice_short, evening_insight, evening_insight_short')
    .eq('unified_user_id', userId)
    .eq('date', today)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows found (expected when no insight exists)
    logger.error({ error, userId, today }, 'Failed to fetch daily insight');
    return reply.status(500).send({
      error: 'INTERNAL_ERROR',
      message: 'Failed to fetch insight',
    });
  }

  // No insight for today
  if (!insight) {
    logger.debug({ userId, today }, 'No insight found for today');
    return reply.send({
      hasInsight: false,
      type: null,
      content: null,
      shortContent: null,
    } satisfies TodayInsightResponse);
  }

  const typedInsight = insight as DailyInsightRow;

  // After 20:00 - show evening insight if available
  if (currentHour >= 20 && typedInsight.evening_insight) {
    logger.debug({ userId, today, type: 'evening' }, 'Returning evening insight');
    return reply.send({
      hasInsight: true,
      type: 'evening',
      content: typedInsight.evening_insight,
      shortContent: typedInsight.evening_insight_short,
    } satisfies TodayInsightResponse);
  }

  // Before 20:00 or no evening insight - show morning advice
  if (typedInsight.morning_advice) {
    logger.debug({ userId, today, type: 'morning' }, 'Returning morning insight');
    return reply.send({
      hasInsight: true,
      type: 'morning',
      content: typedInsight.morning_advice,
      shortContent: typedInsight.morning_advice_short,
    } satisfies TodayInsightResponse);
  }

  // No content available yet (insight record exists but fields are null)
  logger.debug({ userId, today }, 'Insight record exists but no content yet');
  return reply.send({
    hasInsight: false,
    type: null,
    content: null,
    shortContent: null,
  } satisfies TodayInsightResponse);
}

/**
 * Register the /insights/today route with Fastify
 *
 * Registers GET /api/insights/today endpoint.
 *
 * @param fastify - Fastify instance
 */
export function registerTodayInsightRoute(fastify: FastifyInstance): void {
  fastify.get('/insights/today', todayInsightHandler);
}
