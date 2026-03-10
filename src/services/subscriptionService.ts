// services/subscriptionService.ts
// Subscription management service for recurring payments

import { supabase, createSupabaseWithToken } from '../lib/supabaseClient';
import type {
  SubscriptionTier,
  BillingPeriod,
  Subscription,
  SubscriptionPayment,
} from '../types/subscription';
import { getStoredToken } from './authService';

// Edge Function base URL - matches the Supabase project URL
const EDGE_FUNCTION_URL = 'https://johspxgvkbrysxhilmbg.supabase.co/functions/v1';

/**
 * Response from create-subscription Edge Function
 */
export interface CreateSubscriptionResponse {
  confirmation_token: string;
  subscription_id: string;
}

/**
 * Response from cancel-subscription Edge Function
 */
export interface CancelSubscriptionResponse {
  success: boolean;
  expires_at: string;
}

/**
 * Error response from Edge Function
 */
interface EdgeFunctionError {
  error: string;
  code?: string;
}

/**
 * Helper to get access token (Telegram JWT or Supabase session).
 */
async function getAccessToken(): Promise<string> {
  const telegramToken = getStoredToken();
  if (telegramToken) return telegramToken;

  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) return session.access_token;

  throw new Error('Not authenticated');
}

/**
 * Helper to get Supabase client with proper auth.
 */
async function getAuthenticatedClient() {
  const telegramToken = getStoredToken();
  if (telegramToken) {
    return createSupabaseWithToken(telegramToken);
  }
  return supabase;
}

/**
 * Creates a subscription by calling the create-subscription Edge Function.
 * Returns a confirmation token for the YooMoney widget.
 *
 * @param tier - The subscription tier to subscribe to
 * @param billingPeriod - Billing period in months (1, 3, 6, 12)
 * @returns Promise with confirmation_token and subscription_id
 * @throws Error if not authenticated or subscription creation fails
 */
export async function createSubscription(
  tier: SubscriptionTier,
  billingPeriod: BillingPeriod
): Promise<CreateSubscriptionResponse> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${EDGE_FUNCTION_URL}/create-subscription`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      tier,
      billing_period_months: billingPeriod,
      return_url: `${window.location.origin}/payment/success`,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as EdgeFunctionError;
    throw new Error(errorData.error || 'Subscription creation failed');
  }

  return data as CreateSubscriptionResponse;
}

/**
 * Fetches the current user's active subscription.
 * Checks for subscriptions with status 'active', 'past_due', or 'canceled' (not yet expired).
 *
 * @returns Promise with Subscription or null if no active subscription
 */
export async function getActiveSubscription(): Promise<Subscription | null> {
  const client = await getAuthenticatedClient();

  const { data, error } = await client
    .from('subscriptions')
    .select('*')
    .in('status', ['active', 'past_due', 'canceled'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching active subscription:', error);
    return null;
  }

  return data as Subscription | null;
}

/**
 * Cancels a subscription by calling the cancel-subscription Edge Function.
 *
 * @param subscriptionId - The subscription ID to cancel
 * @returns Promise with success status and expiration date
 * @throws Error if not authenticated or cancellation fails
 */
export async function cancelSubscription(
  subscriptionId: string
): Promise<CancelSubscriptionResponse> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${EDGE_FUNCTION_URL}/cancel-subscription`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ subscription_id: subscriptionId }),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as EdgeFunctionError;
    throw new Error(errorData.error || 'Subscription cancellation failed');
  }

  return data as CancelSubscriptionResponse;
}

/**
 * Fetches payment history for a subscription.
 *
 * @param subscriptionId - The subscription ID to fetch payments for
 * @returns Promise with array of SubscriptionPayment
 */
export async function getSubscriptionPaymentHistory(
  subscriptionId: string
): Promise<SubscriptionPayment[]> {
  const client = await getAuthenticatedClient();

  const { data, error } = await client
    .from('subscription_payments')
    .select('*')
    .eq('subscription_id', subscriptionId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching subscription payments:', error);
    return [];
  }

  return (data as SubscriptionPayment[]) || [];
}
