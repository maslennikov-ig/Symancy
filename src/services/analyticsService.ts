// services/analyticsService.ts
// Analytics service for payment funnel and user journey tracking

import { supabase } from '../lib/supabaseClient';
import type { ProductType } from '../types/payment';

/**
 * Persona types for analysis tracking
 */
export type PersonaType = 'arina' | 'cassandra';

/**
 * Analytics events for payment funnel and user journey tracking
 */
export type AnalyticsEvent =
  // Payment funnel events
  | 'tariff_view'
  | 'payment_started'
  | 'payment_succeeded'
  | 'payment_canceled'
  // User journey events
  | 'app_open'
  | 'onboarding_started'
  | 'onboarding_completed'
  | 'analysis_started'
  | 'analysis_completed'
  | 'share_clicked'
  | 'notification_enabled'
  | 'notification_disabled';

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

// =============================================================================
// User Journey Tracking
// =============================================================================

/**
 * Get the current platform (Telegram WebApp or web)
 *
 * @returns Platform string ('android', 'ios', 'web', 'macos', 'tdesktop', etc.)
 */
function getPlatform(): string {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp?.platform) {
    return window.Telegram.WebApp.platform;
  }
  return 'web';
}

/**
 * Track app open event
 *
 * @param source - Optional source of the app open (e.g., 'deeplink', 'notification', 'organic')
 */
export function trackAppOpen(source?: string): Promise<void> {
  return trackEvent({
    event: 'app_open',
    metadata: {
      source: source || 'organic',
      platform: getPlatform(),
    },
  });
}

/**
 * Track onboarding started event
 */
export function trackOnboardingStarted(): Promise<void> {
  return trackEvent({
    event: 'onboarding_started',
  });
}

/**
 * Track onboarding completed event
 *
 * @param language - The language selected during onboarding
 */
export function trackOnboardingCompleted(language: string): Promise<void> {
  return trackEvent({
    event: 'onboarding_completed',
    metadata: {
      language,
    },
  });
}

/**
 * Track analysis started event (photo uploaded)
 *
 * @param persona - The persona selected for analysis ('arina' or 'cassandra')
 */
export function trackAnalysisStarted(persona: PersonaType): Promise<void> {
  return trackEvent({
    event: 'analysis_started',
    metadata: {
      persona,
    },
  });
}

/**
 * Track analysis completed event
 *
 * @param persona - The persona that performed the analysis
 * @param durationMs - Duration of the analysis in milliseconds
 */
export function trackAnalysisCompleted(
  persona: PersonaType,
  durationMs: number
): Promise<void> {
  return trackEvent({
    event: 'analysis_completed',
    metadata: {
      persona,
      duration_ms: durationMs,
    },
  });
}

/**
 * Track share button clicked event
 *
 * @param contentType - Type of content being shared (e.g., 'analysis_result', 'app_link')
 * @param method - Share method used (e.g., 'telegram', 'copy_link', 'native_share')
 */
export function trackShareClicked(
  contentType: string,
  method: string
): Promise<void> {
  return trackEvent({
    event: 'share_clicked',
    metadata: {
      content_type: contentType,
      method,
    },
  });
}

/**
 * Track notification enabled event
 */
export function trackNotificationEnabled(): Promise<void> {
  return trackEvent({
    event: 'notification_enabled',
  });
}

/**
 * Track notification disabled event
 */
export function trackNotificationDisabled(): Promise<void> {
  return trackEvent({
    event: 'notification_disabled',
  });
}
