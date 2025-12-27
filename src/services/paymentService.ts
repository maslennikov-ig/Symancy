// services/paymentService.ts
// Payment service for frontend API calls (Feature 002-pre-mvp-payments)

import { supabase } from '../lib/supabaseClient';
import type { ProductType, UserCredits, Purchase } from '../types/payment';

// Edge Function base URL - matches the Supabase project URL
const EDGE_FUNCTION_URL = 'https://johspxgvkbrysxhilmbg.supabase.co/functions/v1';

/**
 * Response from create-payment Edge Function
 */
export interface CreatePaymentResponse {
  confirmation_token: string;
  purchase_id: string;
}

/**
 * Error response from Edge Function
 */
interface EdgeFunctionError {
  error: string;
  code?: string;
}

/**
 * Creates a payment by calling the create-payment Edge Function.
 * Returns a confirmation token for the YooMoney widget.
 *
 * @param productType - The type of product to purchase
 * @param returnUrl - Optional return URL after payment (defaults to current origin)
 * @returns Promise with confirmation_token and purchase_id
 * @throws Error if not authenticated or payment creation fails
 */
export async function createPayment(
  productType: ProductType,
  returnUrl?: string
): Promise<CreatePaymentResponse> {
  // Get current session for auth header
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${EDGE_FUNCTION_URL}/create-payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      product_type: productType,
      return_url: returnUrl || `${window.location.origin}/payment/success`,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as EdgeFunctionError;
    throw new Error(errorData.error || 'Payment creation failed');
  }

  return data as CreatePaymentResponse;
}

/**
 * Fetches the current user's credit balance.
 * Returns null if user is not authenticated.
 * Returns default zero credits if no record exists yet.
 *
 * @returns Promise with UserCredits or null
 */
export async function getUserCredits(): Promise<UserCredits | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('user_credits')
    .select('*')
    .eq('user_id', user.id)
    .single();

  // PGRST116 = "No rows found" - not an error, just no credits yet
  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching credits:', error);
    return null;
  }

  // Return data if exists, otherwise return default zero credits
  return data || {
    user_id: user.id,
    basic_credits: 0,
    pro_credits: 0,
    cassandra_credits: 0,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Fetches the user's purchase history with pagination.
 *
 * @param limit - Maximum number of purchases to return (default 20)
 * @param offset - Number of purchases to skip (default 0)
 * @returns Promise with purchases array and total count
 */
export async function getPurchaseHistory(
  limit = 20,
  offset = 0
): Promise<{ purchases: Purchase[]; total: number }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { purchases: [], total: 0 };

  // Get total count first
  const { count, error: countError } = await supabase
    .from('purchases')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if (countError) {
    console.error('Error counting purchases:', countError);
    return { purchases: [], total: 0 };
  }

  // Get paginated purchases
  const { data, error } = await supabase
    .from('purchases')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching purchases:', error);
    return { purchases: [], total: 0 };
  }

  return {
    purchases: (data as Purchase[]) || [],
    total: count || 0,
  };
}

/**
 * Checks if user has enough credits for a specific analysis type.
 *
 * @param creditType - Type of credit to check ('basic', 'pro', 'cassandra')
 * @returns Promise with boolean indicating if user has credits
 */
export async function hasCredits(
  creditType: 'basic' | 'pro' | 'cassandra'
): Promise<boolean> {
  const credits = await getUserCredits();
  if (!credits) return false;

  switch (creditType) {
    case 'basic':
      return credits.basic_credits > 0;
    case 'pro':
      return credits.pro_credits > 0;
    case 'cassandra':
      return credits.cassandra_credits > 0;
    default:
      return false;
  }
}
