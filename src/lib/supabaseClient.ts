import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://johspxgvkbrysxhilmbg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvaHNweGd2a2JyeXN4aGlsbWJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxMTcyNjcsImV4cCI6MjA4MTY5MzI2N30.CkT-rsnbaUMveIOEYnpzUxOxZ-4LvpwHicB4xQ9L0_Y';

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase URL and Anon Key must be provided.");
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