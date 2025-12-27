// services/analyticsService.ts
// Analytics service for payment funnel tracking (Feature 002-pre-mvp-payments)

import { supabase } from '../lib/supabaseClient';
import type { ProductType } from '../types/payment';

/**
 * Analytics events for payment funnel tracking
 */
export type AnalyticsEvent =
  | 'tariff_view'
  | 'payment_started'
  | 'payment_succeeded'
  | 'payment_canceled';

/**
 * Options for tracking an analytics event
 */
export interface TrackEventOptions {
  event: AnalyticsEvent;
  productType?: ProductType;
  amountRub?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Track payment funnel event for conversion analytics.
 * Inserts into payment_analytics table.
 * Fails silently to avoid disrupting user experience.
 *
 * @param options - Event tracking options
 */
export async function trackEvent({
  event,
  productType,
  amountRub,
  metadata,
}: TrackEventOptions): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from('payment_analytics').insert({
      event,
      user_id: user?.id || null,
      product_type: productType || null,
      amount_rub: amountRub || null,
      metadata: metadata || null,
    });
  } catch (error) {
    // Don't fail the app if analytics fails - log and continue
    console.error('Analytics tracking error:', error);
  }
}

/**
 * Track tariff selector view (modal opened)
 */
export function trackTariffView(): Promise<void> {
  return trackEvent({ event: 'tariff_view' });
}

/**
 * Track payment initiation (user selected a tariff and clicked pay)
 *
 * @param productType - The product type selected
 * @param amountRub - The amount in rubles
 */
export function trackPaymentStarted(
  productType: ProductType,
  amountRub: number
): Promise<void> {
  return trackEvent({ event: 'payment_started', productType, amountRub });
}

/**
 * Track successful payment
 *
 * @param productType - The product type purchased
 * @param amountRub - The amount paid in rubles
 * @param metadata - Optional additional metadata
 */
export function trackPaymentSucceeded(
  productType: ProductType,
  amountRub: number,
  metadata?: Record<string, unknown>
): Promise<void> {
  return trackEvent({
    event: 'payment_succeeded',
    productType,
    amountRub,
    metadata,
  });
}

/**
 * Track canceled payment
 *
 * @param productType - The product type that was attempted
 * @param amountRub - The amount that was attempted
 * @param metadata - Optional additional metadata (e.g., reason)
 */
export function trackPaymentCanceled(
  productType: ProductType,
  amountRub: number,
  metadata?: Record<string, unknown>
): Promise<void> {
  return trackEvent({
    event: 'payment_canceled',
    productType,
    amountRub,
    metadata,
  });
}
