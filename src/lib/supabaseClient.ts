import { createClient, SupabaseClient } from '@supabase/supabase-js';

// SECURITY: Credentials loaded from environment variables
// Never hardcode credentials in source code
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be provided in environment variables.");
}

// Default client for anonymous/Supabase Auth users
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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