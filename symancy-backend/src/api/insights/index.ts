/**
 * Insights Routes Registration
 *
 * Centralized registration point for all insights-related endpoints.
 * Exports a single function to register all insight routes with Fastify.
 *
 * @module api/insights
 */
import type { FastifyInstance } from 'fastify';
import { registerTodayInsightRoute } from './today.js';

/**
 * Register all insights routes
 *
 * Registers the following endpoints:
 * - GET /api/insights/today - Get today's personalized insight
 *
 * @param fastify - Fastify instance
 *
 * @example
 * ```typescript
 * import { registerInsightsRoutes } from './api/insights/index.js';
 *
 * // In app.ts:
 * registerInsightsRoutes(fastify);
 * logger.info("Insights routes registered");
 * ```
 */
export function registerInsightsRoutes(fastify: FastifyInstance): void {
  registerTodayInsightRoute(fastify);
}
