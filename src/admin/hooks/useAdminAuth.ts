/**
 * Admin Authentication Hook
 *
 * Provides authentication state and admin authorization for the admin panel.
 * Supports two authentication methods:
 * 1. Supabase Auth (Google/email) - uses `is_admin()` RPC
 * 2. Telegram login (linked accounts) - uses `is_admin_by_auth_id()` RPC
 *
 * @module admin/hooks/useAdminAuth
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { User } from '@supabase/supabase-js';
import { getStoredToken, getCurrentUser, clearToken } from '../../services/authService';
import type { UnifiedUser } from '../../types/omnichannel';

/**
 * Return type for useAdminAuth hook
 */
interface UseAdminAuthReturn {
  /** Whether the current user is an admin */
  isAdmin: boolean;
  /** Whether authentication state is still loading */
  isLoading: boolean;
  /** Current authenticated Supabase user or null */
  user: User | null;
  /** Current authenticated Telegram user or null (for linked accounts) */
  unifiedUser: UnifiedUser | null;
  /** Whether user is authenticated via Telegram */
  isTelegramUser: boolean;
  /** Function to sign out the current user */
  signOut: () => Promise<void>;
}

/**
 * Hook for admin panel authentication and authorization.
 *
 * Supports both Supabase Auth and Telegram login for linked accounts.
 * Admin status is determined by:
 * - `is_admin()` Postgres function for Supabase Auth users
 * - `is_admin_by_auth_id(auth_id)` for Telegram users with linked accounts
 *
 * @returns {UseAdminAuthReturn} Authentication state and utilities
 *
 * @example
 * ```tsx
 * function AdminPage() {
 *   const { isAdmin, isLoading, user, unifiedUser, signOut } = useAdminAuth();
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (!isAdmin) return <ForbiddenPage />;
 *
 *   const displayName = user?.email || unifiedUser?.display_name || 'Admin';
 *   return <AdminContent displayName={displayName} onLogout={signOut} />;
 * }
 * ```
 */
export function useAdminAuth(): UseAdminAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [unifiedUser, setUnifiedUser] = useState<UnifiedUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isTelegramUser, setIsTelegramUser] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      try {
        // Priority 1: Check Supabase Auth session
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;

        const currentUser = session?.user ?? null;
        setUser(currentUser);

        // If Supabase user is authenticated, check admin via is_admin()
        if (currentUser) {
          const { data: adminCheck } = await supabase.rpc('is_admin');
          if (!cancelled) {
            setIsAdmin(adminCheck === true);
            setIsTelegramUser(false);
            setUnifiedUser(null);
            setIsLoading(false);
          }
          return;
        }

        // Priority 2: Check Telegram token for linked accounts
        const telegramToken = getStoredToken();
        if (telegramToken) {
          try {
            const telegramUser = await getCurrentUser(telegramToken);
            if (cancelled) return;

            setUnifiedUser(telegramUser);
            setIsTelegramUser(true);

            // Check if user has linked account with admin rights
            if (telegramUser.auth_id) {
              const { data: adminCheck } = await supabase.rpc('is_admin_by_auth_id', {
                p_auth_id: telegramUser.auth_id,
              });
              if (!cancelled) {
                setIsAdmin(adminCheck === true);
              }
            } else {
              // No linked account - not admin
              setIsAdmin(false);
            }

            if (!cancelled) {
              setIsLoading(false);
            }
            return;
          } catch (error) {
            // Token invalid or expired - clear it
            console.warn('Telegram token validation failed:', error);
            clearToken();
          }
        }

        // No authentication found
        if (!cancelled) {
          setIsAdmin(false);
          setIsTelegramUser(false);
          setUnifiedUser(null);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Admin auth check failed:', error);
        if (!cancelled) {
          setUser(null);
          setUnifiedUser(null);
          setIsAdmin(false);
          setIsTelegramUser(false);
          setIsLoading(false);
        }
      }
    };

    checkAuth();

    // Listen for Supabase auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (cancelled) return;

      const currentUser = session?.user ?? null;
      setUser(currentUser);

      // Re-check admin status on auth state change
      if (currentUser) {
        setIsTelegramUser(false);
        setUnifiedUser(null);
        const { data: adminCheck } = await supabase.rpc('is_admin');
        if (!cancelled) {
          setIsAdmin(adminCheck === true);
          setIsLoading(false);
        }
      } else {
        // User logged out from Supabase - check Telegram token
        const telegramToken = getStoredToken();
        if (telegramToken) {
          try {
            const telegramUser = await getCurrentUser(telegramToken);
            if (cancelled) return;

            setUnifiedUser(telegramUser);
            setIsTelegramUser(true);

            if (telegramUser.auth_id) {
              const { data: adminCheck } = await supabase.rpc('is_admin_by_auth_id', {
                p_auth_id: telegramUser.auth_id,
              });
              if (!cancelled) {
                setIsAdmin(adminCheck === true);
              }
            } else {
              setIsAdmin(false);
            }
          } catch {
            clearToken();
            setIsAdmin(false);
            setIsTelegramUser(false);
            setUnifiedUser(null);
          }
        } else {
          setIsAdmin(false);
          setIsTelegramUser(false);
          setUnifiedUser(null);
        }

        if (!cancelled) {
          setIsLoading(false);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
      cancelled = true;
    };
  }, []);

  const signOut = useCallback(async () => {
    if (isTelegramUser) {
      // Sign out from Telegram session
      clearToken();
      setUnifiedUser(null);
      setIsTelegramUser(false);
      setIsAdmin(false);
    } else {
      // Sign out from Supabase
      await supabase.auth.signOut();
    }
  }, [isTelegramUser]);

  return {
    isAdmin,
    isLoading,
    user,
    unifiedUser,
    isTelegramUser,
    signOut,
  };
}
