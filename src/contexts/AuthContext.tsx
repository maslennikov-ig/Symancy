
import React, { createContext, useState, useEffect, useContext, useRef, ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Session, User, Provider } from '@supabase/supabase-js';
import type { UnifiedUser, TelegramAuthData } from '../types/omnichannel';
import { telegramLogin, webAppLogin, getCurrentUser, storeToken, getStoredToken, clearToken } from '../services/authService';
import { isTelegramWebApp } from '../hooks/useTelegramWebApp';

interface AuthContextType {
    user: User | null;
    unifiedUser: UnifiedUser | null;  // Telegram user from unified_users table
    session: Session | null;
    loading: boolean;
    isAuthenticated: boolean;
    isTelegramUser: boolean;
    signIn: (email: string) => Promise<void>;
    signInWithProvider: (provider: Provider) => Promise<void>;
    signInWithTelegram: (telegramData: TelegramAuthData) => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [unifiedUser, setUnifiedUser] = useState<UnifiedUser | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [isTelegramUser, setIsTelegramUser] = useState(false);

    // M1 FIX: Use proper React ref to track Telegram user state in subscription callback
    const isTelegramUserRef = useRef(false);

    useEffect(() => {
        // Cancellation flag to prevent state updates after unmount
        let cancelled = false;

        const initAuth = async () => {
            // Priority 1: Check for Telegram WebApp initData (auto-auth in Mini Apps)
            if (isTelegramWebApp()) {
                const initData = window.Telegram?.WebApp?.initData;
                if (initData) {
                    try {
                        const response = await webAppLogin(initData);
                        if (cancelled) return;

                        storeToken(response.token, response.expires_at);
                        setUnifiedUser(response.user);
                        setIsTelegramUser(true);
                        isTelegramUserRef.current = true;  // M1 FIX: Update ref immediately

                        // Clean up any existing Supabase session
                        const { data: { session: existingSession } } = await supabase.auth.getSession();
                        if (existingSession && !cancelled) {
                            await supabase.auth.signOut();
                        }

                        setLoading(false);
                        return;
                    } catch (error) {
                        if (cancelled) return;
                        console.error('WebApp auto-auth failed:', error);
                        // Continue to other auth methods
                    }
                }
            }

            // Priority 2: Check for stored Telegram token
            const telegramToken = getStoredToken();
            if (telegramToken) {
                try {
                    const fetchedUser = await getCurrentUser(telegramToken);
                    if (cancelled) return;

                    setUnifiedUser(fetchedUser);
                    setIsTelegramUser(true);
                    isTelegramUserRef.current = true;  // M1 FIX: Update ref immediately

                    // Clean up any existing Supabase session to prevent dual-session state
                    const { data: { session: existingSession } } = await supabase.auth.getSession();
                    if (existingSession && !cancelled) {
                        await supabase.auth.signOut();
                    }

                    setLoading(false);
                    return;
                } catch (error) {
                    if (cancelled) return;
                    console.error('Telegram token validation failed:', error);
                    clearToken();
                }
            }

            if (cancelled) return;

            // Priority 3: Fall back to Supabase session
            const { data: { session } } = await supabase.auth.getSession();
            if (cancelled) return;

            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        };

        initAuth();

        // M1 FIX: Use ref.current in subscription callback to get latest value
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (cancelled) return;
            // Only update if not a Telegram user
            if (!isTelegramUserRef.current) {
                setSession(session);
                setUser(session?.user ?? null);
            }
        });

        return () => {
            cancelled = true;
            subscription.unsubscribe();
        };
    }, []); // Empty dependency array - safe now because we use mutable ref

    const signIn = async (email: string) => {
        const { error } = await supabase.auth.signInWithOtp({ 
            email,
            options: {
                emailRedirectTo: window.location.origin
            }
        });
        if (error) throw error;
    };

    const signInWithProvider = async (provider: Provider) => {
        const { error } = await supabase.auth.signInWithOAuth({ provider });
        if (error) console.error(`Error logging in with ${provider}:`, error.message);
    };

    const signInWithTelegram = async (telegramData: TelegramAuthData) => {
        const response = await telegramLogin(telegramData);
        storeToken(response.token, response.expires_at);
        setUnifiedUser(response.user);
        setIsTelegramUser(true);
        isTelegramUserRef.current = true;  // M1 FIX: Keep ref in sync
    };

    const signOut = async () => {
        if (isTelegramUser) {
            clearToken();
            setUnifiedUser(null);
            setIsTelegramUser(false);
            isTelegramUserRef.current = false;  // M1 FIX: Keep ref in sync
        } else {
            const { error } = await supabase.auth.signOut();
            if (error) console.error('Error logging out:', error.message);
        }
    };

    const isAuthenticated = !!(user || unifiedUser);

    const value = {
        user,
        unifiedUser,
        session,
        loading,
        isAuthenticated,
        isTelegramUser,
        signIn,
        signInWithProvider,
        signInWithTelegram,
        signOut,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
