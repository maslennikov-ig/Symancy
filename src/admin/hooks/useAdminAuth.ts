/**
 * Admin Authentication Hook
 *
 * Provides authentication state and admin authorization for the admin panel.
 * Uses Supabase Auth for authentication and checks admin status via the
 * `is_admin()` Postgres function (Single Source of Truth from system_config).
 *
 * @module admin/hooks/useAdminAuth
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { User } from '@supabase/supabase-js';

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
 * Admin status is determined by the `is_admin()` Postgres function which
 * reads from `system_config.admin_emails`. This ensures a Single Source
 * of Truth — admins are managed only in the database.
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;

        const currentUser = session?.user ?? null;
        setUser(currentUser);

        // Check admin status from database if user is authenticated
        if (currentUser) {
          const { data: adminCheck } = await supabase.rpc('is_admin');
          if (!cancelled) {
            setIsAdmin(adminCheck === true);
          }
        } else {
          setIsAdmin(false);
        }

        if (!cancelled) {
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Admin auth check failed:', error);
        if (!cancelled) {
          setUser(null);
          setIsAdmin(false);
          setIsLoading(false);
        }
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (cancelled) return;

      const currentUser = session?.user ?? null;
      setUser(currentUser);

      // Re-check admin status on auth state change
      if (currentUser) {
        const { data: adminCheck } = await supabase.rpc('is_admin');
        if (!cancelled) {
          setIsAdmin(adminCheck === true);
        }
      } else {
        setIsAdmin(false);
      }

      if (!cancelled) {
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      cancelled = true;
    };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return {
    isAdmin,
    isLoading,
    user,
    signOut,
  };
}
