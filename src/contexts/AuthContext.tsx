
import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Session, User, Provider } from '@supabase/supabase-js';
import type { UnifiedUser, TelegramAuthData } from '../types/omnichannel';
import { telegramLogin, getCurrentUser, storeToken, getStoredToken, clearToken } from '../services/authService';

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

    useEffect(() => {
        const initAuth = async () => {
            // Check for Telegram token first
            const telegramToken = getStoredToken();
            if (telegramToken) {
                try {
                    const user = await getCurrentUser(telegramToken);
                    setUnifiedUser(user);
                    setIsTelegramUser(true);
                    setLoading(false);
                    return;
                } catch (error) {
                    console.error('Telegram token validation failed:', error);
                    clearToken();
                }
            }

            // Fall back to Supabase session
            const { data: { session } } = await supabase.auth.getSession();
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        };

        initAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            // Only update if not a Telegram user
            if (!isTelegramUser) {
                setSession(session);
                setUser(session?.user ?? null);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [isTelegramUser]);

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
    };

    const signOut = async () => {
        if (isTelegramUser) {
            clearToken();
            setUnifiedUser(null);
            setIsTelegramUser(false);
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
