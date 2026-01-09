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
import { isInsideTelegramClient } from '../../../hooks/useTelegramWebApp';
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

                {/* Telegram Login Widget - only show outside of Telegram client */}
                {!isInsideTelegramClient() && (
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

                {/* Inside Telegram client - show button to open via bot for auto-login */}
                {isInsideTelegramClient() && (
                    <div className="mt-4 p-3 bg-muted/50 rounded-md text-center">
                        <p className="text-sm text-muted-foreground mb-3">
                            {t('auth.telegram.webAppHint')}
                        </p>
                        <a
                            href="https://t.me/coffeeveda_bot/app"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-white font-medium transition-colors"
                            style={{ backgroundColor: '#0088cc' }}
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                            </svg>
                            {t('auth.telegram.openBotButton')}
                        </a>
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