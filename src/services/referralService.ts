// services/referralService.ts
// Service for the referral program: fetches the user's referral code, link and stats
// from the backend. Supports both Supabase Auth (web) and Telegram JWT users,
// mirroring the dual-auth token resolution used in paymentService/subscriptionService.

import { supabase } from '../lib/supabaseClient';
import { getStoredToken } from './authService';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * Aggregated referral statistics returned by the backend.
 *
 * Keep in sync with `symancy-backend/src/modules/referrals/service.ts`
 * (ReferralStats) — there is no shared-types package for these yet.
 */
export interface ReferralStats {
  /** The user's own referral code (null until generated). */
  code: string | null;
  /** Number of users who started via this referral link. */
  invited: number;
  /** Number of invited users who completed their first analysis. */
  activated: number;
  /** Total bonus credits earned from activated referrals. */
  credits_earned: number;
  /** Invited users who have not activated yet. */
  pending: number;
}

/**
 * Response payload of `GET /api/referral`.
 */
export interface ReferralData {
  /** The user's referral code. */
  code: string;
  /** Ready-to-share link, e.g. `https://t.me/<bot>?start=ref_<code>`. */
  link: string;
  /** Aggregated referral stats. */
  stats: ReferralStats;
}

/**
 * Resolve the access token for an authorized backend `/api` request.
 * Telegram JWT (localStorage) takes precedence, then the Supabase Auth session.
 *
 * @returns Bearer token or null if the user is not authenticated.
 */
async function resolveAccessToken(): Promise<string | null> {
  const telegramToken = getStoredToken();
  if (telegramToken) {
    return telegramToken;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

/**
 * Fetch the current user's referral code, link and stats.
 *
 * @returns Promise with {@link ReferralData}.
 * @throws Error if the user is not authenticated or the request fails.
 */
export async function getReferralInfo(): Promise<ReferralData> {
  const accessToken = await resolveAccessToken();

  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_BASE_URL}/api/referral`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: 'Failed to load referral info' }));
    throw new Error(error.message || error.error || 'Failed to load referral info');
  }

  return response.json() as Promise<ReferralData>;
}
