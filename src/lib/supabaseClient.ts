import { createClient, SupabaseClient } from '@supabase/supabase-js';

// SECURITY: Credentials loaded from environment variables
// Never hardcode credentials in source code
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be provided in environment variables.");
}

/**
 * auth-js serializes every auth call through the Web Locks API (navigatorLock)
 * to coordinate token refresh across browser tabs. Inside the Telegram in-app
 * WebView that API is broken: the lock is acquired and never released, so EVERY
 * `supabase.auth.*` call (getSession, signOut, updateUser, signInWithPassword)
 * hangs forever — this is what froze the admin login/reset-password screens.
 *
 * A Telegram WebView is a single embedded context with no real cross-tab
 * concern, so there we swap the lock for a pass-through. Real browsers keep the
 * default navigatorLock and stay multi-tab safe. telegram-web-app.js loads in
 * <head> before this module, so window.Telegram.WebApp is reliable here.
 */
const isTelegramWebView =
    typeof window !== "undefined" &&
    !!(window as unknown as { Telegram?: { WebApp?: unknown } }).Telegram?.WebApp;

const passThroughLock = async <R>(
    _name: string,
    _acquireTimeout: number,
    fn: () => Promise<R>
): Promise<R> => fn();

// Default client for anonymous/Supabase Auth users
export const supabase = createClient(
    supabaseUrl,
    supabaseAnonKey,
    isTelegramWebView ? { auth: { lock: passThroughLock } } : undefined
);

/**
 * Create a Supabase client with custom JWT (for Telegram users)
 *
 * @param accessToken - JWT token from backend auth
 * @returns SupabaseClient configured with custom token
 */
export function createSupabaseWithToken(accessToken: string): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}