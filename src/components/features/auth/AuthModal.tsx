import React, { useState, useMemo } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useAuth } from '../../../contexts/AuthContext';
import { Button } from '../../ui/button';
import { GoogleIcon } from './GoogleIcon';
import { AppleIcon } from './AppleIcon';
import { FacebookIcon } from './FacebookIcon';
import { TelegramLoginButton } from './TelegramLoginButton';
import { LoaderIcon } from '../../icons/LoaderIcon';
import { translations } from '../../../lib/i18n';
import { ChevronDownIcon } from '../../icons/ChevronDownIcon';
import { isTelegramWebApp } from '../../../hooks/useTelegramWebApp';
// Fix: Import Provider type from supabase-js to allow type casting.
import { Provider } from '@supabase/supabase-js';

interface AuthModalProps {
    onClose: () => void;
    t: (key: keyof typeof translations.en) => string;
}

const AuthModal: React.FC<AuthModalProps> = ({ onClose, t }) => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [showMore, setShowMore] = useState(false);
    const [telegramLoading, setTelegramLoading] = useState(false);
    const { signInWithProvider, signInWithTelegram } = useAuth();

    const handleMagicLinkSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo: window.location.origin,
            },
        });
        if (error) {
            setMessage(error.message);
        } else {
            setMessage(t('auth.magicLink.sent'));
        }
        setLoading(false);
    };

    // OAuth providers (Telegram uses separate Login Widget below)
    const allProviders = useMemo(() => [
        { provider: 'google', Icon: GoogleIcon, label: t('auth.signInWithGoogle') },
        { provider: 'apple', Icon: AppleIcon, label: t('auth.signInWithApple') },
        { provider: 'facebook', Icon: FacebookIcon, label: t('auth.signInWithFacebook') },
    ] as const, [t]);

    const [defaultProviders, otherProviders] = useMemo(() => {
        const defaults = ['google', 'apple'];
        const defaultList = allProviders.filter(p => defaults.includes(p.provider));
        const otherList = allProviders.filter(p => !defaults.includes(p.provider));
        return [defaultList, otherList];
    }, [allProviders]);

    return (
        <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-modal-title"
        >
            <div 
                className="bg-popover text-popover-foreground rounded-lg shadow-2xl p-8 w-full max-w-sm m-auto relative"
                onClick={(e) => e.stopPropagation()}
            >
                <button onClick={onClose} className="absolute top-2 right-2 text-muted-foreground hover:text-foreground p-2 rounded-full text-2xl leading-none" aria-label="Close">
                    &times;
                </button>
                <div className="text-center">
                    <h2 id="auth-modal-title" className="text-2xl font-display font-bold">{t('auth.modalTitle')}</h2>
                </div>

                <div className="mt-6 space-y-3">
                    {defaultProviders.map(({ provider, Icon, label }) => (
                         <Button
                            key={provider}
                            variant="outline"
                            className="w-full h-12 text-base justify-center"
                            // Fix: Cast provider to `Provider` to resolve TypeScript error for non-standard providers like 'telegram'.
                            onClick={() => signInWithProvider(provider as Provider)}
                        >
                            <Icon className="w-5 h-5 mr-3" />
                            <span>{label}</span>
                        </Button>
                    ))}

                    {showMore && otherProviders.map(({ provider, Icon, label }) => (
                         <Button
                            key={provider}
                            variant="outline"
                            className="w-full h-12 text-base justify-center animate-accordion-down"
                            // Fix: Cast provider to `Provider` to resolve TypeScript error for non-standard providers like 'telegram'.
                            onClick={() => signInWithProvider(provider as Provider)}
                        >
                            <Icon className="w-5 h-5 mr-3" />
                            <span>{label}</span>
                        </Button>
                    ))}
                </div>

                <div className="mt-4 text-center">
                    {/* FIX: Use t function for "Show more" button text. */}
                    <Button variant="link" onClick={() => setShowMore(!showMore)} className="text-sm text-muted-foreground">
                        {t('auth.showMore')}
                        <ChevronDownIcon className={`w-4 h-4 ml-1 transition-transform ${showMore ? 'rotate-180' : ''}`} />
                    </Button>
                </div>

                {/* Telegram Login Widget - only show outside of Telegram Mini App */}
                {!isTelegramWebApp() && (
                    <div className="mt-4 flex justify-center">
                        <TelegramLoginButton
                            onAuth={async (telegramData) => {
                                setTelegramLoading(true);
                                setError(null);
                                setMessage('');
                                try {
                                    await signInWithTelegram(telegramData);
                                    onClose();
                                } catch (err) {
                                    console.error('Telegram login error:', err);
                                    const errorMessage = err instanceof Error
                                        ? err.message
                                        : t('auth.telegram.failed');
                                    setError(errorMessage);
                                } finally {
                                    setTelegramLoading(false);
                                }
                            }}
                            size="large"
                            radius={8}
                        />
                    </div>
                )}

                {/* Inside Telegram Mini App - show info message */}
                {isTelegramWebApp() && (
                    <div className="mt-4 p-3 bg-muted/50 rounded-md text-sm text-center text-muted-foreground">
                        {t('auth.telegram.webAppHint')}
                    </div>
                )}

                {/* Error message */}
                {error && (
                    <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm text-center">
                        {error}
                    </div>
                )}

                <div className="my-4 flex items-center">
                    <div className="flex-grow border-t border-border"></div>
                    <span className="flex-shrink mx-4 text-xs text-muted-foreground uppercase">{t('auth.divider')}</span>
                    <div className="flex-grow border-t border-border"></div>
                </div>

                <form onSubmit={handleMagicLinkSignIn}>
                    <label htmlFor="email-input" className="sr-only">Email</label>
                    <input
                        id="email-input"
                        type="email"
                        placeholder={t('auth.emailPlaceholder')}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full px-4 py-3 rounded-md bg-background border border-input text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
                    />
                     <Button
                        type="submit"
                        disabled={loading}
                        className="w-full mt-4 h-12 text-base"
                    >
                        {loading && <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />}
                        {t('auth.magicLink.send')}
                    </Button>
                </form>

                {message && (
                    <p className="mt-4 text-center text-sm text-green-600 dark:text-green-400">{message}</p>
                )}
            </div>
        </div>
    );
};

export default AuthModal;