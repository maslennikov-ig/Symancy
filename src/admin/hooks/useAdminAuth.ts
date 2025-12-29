/**
 * Admin Authentication Hook
 *
 * Provides authentication state and admin authorization for the admin panel.
 * Uses Supabase Auth for authentication and a client-side email whitelist
 * for initial admin check. Server-side authorization is enforced by RLS
 * policies using the `is_admin()` Postgres function.
 *
 * @module admin/hooks/useAdminAuth
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { User } from '@supabase/supabase-js';

/**
 * List of admin email addresses.
 * This is a client-side check for UX purposes (showing 403 page quickly).
 * Actual security is enforced by RLS policies in Supabase using is_admin() function.
 *
 * @constant
 */
const ADMIN_EMAILS = ['maslennikov.ig@gmail.com'] as const;

/**
 * Return type for useAdminAuth hook
 */
interface UseAdminAuthReturn {
  /** Whether the current user is an admin */
  isAdmin: boolean;
  /** Whether authentication state is still loading */
  isLoading: boolean;
  /** Current authenticated user or null */
  user: User | null;
  /** Function to sign out the current user */
  signOut: () => Promise<void>;
}

/**
 * Hook for admin panel authentication and authorization.
 *
 * @returns {UseAdminAuthReturn} Authentication state and utilities
 *
 * @example
 * ```tsx
 * function AdminPage() {
 *   const { isAdmin, isLoading, user, signOut } = useAdminAuth();
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (!isAdmin) return <ForbiddenPage />;
 *
 *   return <AdminContent user={user} onLogout={signOut} />;
 * }
 * ```
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
      subscription.unsubscribe(); // Stop events first
      cancelled = true;
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
