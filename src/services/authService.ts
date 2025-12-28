// services/authService.ts
// Authentication service for Telegram login and token management

import type { TelegramAuthData, AuthResponse, UnifiedUser } from '../types/omnichannel';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * Authenticate with Telegram Login Widget data
 *
 * @param telegramData - Telegram authentication data from Login Widget
 * @returns Promise<AuthResponse> - Authentication response with user, token, and expiration
 * @throws Error if authentication fails
 */
export async function telegramLogin(telegramData: TelegramAuthData): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/telegram`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(telegramData),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Login failed' }));
    throw new Error(error.message || 'Login failed');
  }

  return response.json();
}

/**
 * Authenticate with Telegram WebApp initData
 *
 * @param initData - Raw initData string from Telegram.WebApp.initData
 * @returns Promise<AuthResponse> - Authentication response with user, token, and expiration
 * @throws Error if authentication fails
 */
export async function webAppLogin(initData: string): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/webapp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ init_data: initData }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'WebApp login failed' }));
    throw new Error(error.message || 'WebApp login failed');
  }

  return response.json();
}

/**
 * Get current user from stored token
 *
 * @param token - JWT token from localStorage
 * @returns Promise<UnifiedUser> - Current authenticated user
 * @throws Error if token is invalid or expired
 */
export async function getCurrentUser(token: string): Promise<UnifiedUser> {
  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Session expired');
    }
    const error = await response.json().catch(() => ({ message: 'Failed to get user' }));
    throw new Error(error.message || 'Failed to get user');
  }

  const data = await response.json();
  return data.user;
}

/**
 * Token storage helpers
 */
const TOKEN_KEY = 'symancy_token';
const TOKEN_EXPIRY_KEY = 'symancy_token_expires';

/**
 * Refresh threshold: warn when token expires within 5 minutes
 */
const TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Store JWT token and expiration in localStorage
 *
 * @param token - JWT token to store
 * @param expiresAt - ISO 8601 expiration timestamp
 */
export function storeToken(token: string, expiresAt: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(TOKEN_EXPIRY_KEY, expiresAt);
}

/**
 * Get stored token from localStorage if valid
 * Returns null if token is missing or expired
 *
 * @returns string | null - Valid token or null
 */
export function getStoredToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  const expiresAt = localStorage.getItem(TOKEN_EXPIRY_KEY);

  if (!token || !expiresAt) {
    return null;
  }

  const expiryDate = new Date(expiresAt);
  const now = new Date();

  // Check if expired
  if (expiryDate <= now) {
    clearToken();
    return null;
  }

  // Warn if token expires soon (for future refresh logic)
  const timeUntilExpiry = expiryDate.getTime() - now.getTime();
  if (timeUntilExpiry < TOKEN_REFRESH_THRESHOLD_MS) {
    console.warn(`Token expires in ${Math.floor(timeUntilExpiry / 1000)}s. Consider refreshing.`);
    // TODO: Implement token refresh logic when backend supports it
  }

  return token;
}

/**
 * Clear stored token and expiration from localStorage
 */
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
}
