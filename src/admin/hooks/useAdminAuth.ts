import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { User } from '@supabase/supabase-js';

// Admin email whitelist
const ADMIN_EMAILS = ['maslennikov.ig@gmail.com'] as const;

interface UseAdminAuthReturn {
  isAdmin: boolean;
  isLoading: boolean;
  user: User | null;
  signOut: () => Promise<void>;
}

/**
 * Hook for admin panel authentication
 * Checks if current user is in the admin whitelist
 */
export function useAdminAuth(): UseAdminAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!cancelled) {
          setUser(session?.user ?? null);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Admin auth check failed:', error);
        if (!cancelled) {
          setUser(null);
          setIsLoading(false);
        }
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) {
        setUser(session?.user ?? null);
        setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const isAdmin = user?.email != null && ADMIN_EMAILS.includes(user.email as typeof ADMIN_EMAILS[number]);

  return {
    isAdmin,
    isLoading,
    user,
    signOut,
  };
}
