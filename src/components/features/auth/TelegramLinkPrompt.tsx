/**
 * TelegramLinkPrompt Component
 *
 * A prompt component shown to web-only users (registered via email/OAuth without Telegram)
 * encouraging them to connect their Telegram account for enhanced features.
 *
 * Features:
 * - Shows benefits of connecting Telegram (notifications, offline messages, shared credits)
 * - Uses TelegramLoginButton for seamless linking
 * - Supports dismissal for users who prefer not to link
 * - i18n support for all 3 languages (ru, en, zh)
 * - Respects light/dark theme
 *
 * @see tasks.md T041 - Phase 5: User Story 3 - Web-only User Journey
 */

import React, { useState, useCallback } from 'react';
import { TelegramLoginButton } from './TelegramLoginButton';
import { useAuth } from '../../../contexts/AuthContext';
import { translations, Lang, t as i18n_t } from '../../../lib/i18n';
import type { TelegramAuthData } from '../../../types/omnichannel';

/**
 * Icons for the benefits list - using inline SVGs for minimal dependencies
 */
const BellIcon = () => (
  <svg
    className="w-5 h-5 text-primary flex-shrink-0"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
    />
  </svg>
);

const MessageIcon = () => (
  <svg
    className="w-5 h-5 text-primary flex-shrink-0"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
    />
  </svg>
);

const CreditCardIcon = () => (
  <svg
    className="w-5 h-5 text-primary flex-shrink-0"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
    />
  </svg>
);

const TelegramIcon = () => (
  <svg
    className="w-6 h-6 text-[#0088cc]"
    fill="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.96 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
  </svg>
);

/**
 * Props for TelegramLinkPrompt component
 */
interface TelegramLinkPromptProps {
  /**
   * Current language for translations
   * @default 'ru'
   */
  language?: Lang;

  /**
   * Translation function
   */
  t?: (key: keyof typeof translations.en) => string;

  /**
   * Callback when user dismisses the prompt
   */
  onDismiss?: () => void;

  /**
   * Callback when Telegram is successfully linked
   */
  onLinked?: () => void;

  /**
   * CSS class name for styling
   */
  className?: string;

  /**
   * Variant: 'card' for standalone card, 'inline' for compact banner
   * @default 'card'
   */
  variant?: 'card' | 'inline';
}

/**
 * TelegramLinkPrompt component
 *
 * Encourages web-only users to connect their Telegram account.
 * Provides a list of benefits and the Telegram Login Widget for easy linking.
 *
 * @example
 * ```tsx
 * <TelegramLinkPrompt
 *   language="en"
 *   onDismiss={() => setShowPrompt(false)}
 *   onLinked={() => refreshUser()}
 * />
 * ```
 */
export function TelegramLinkPrompt({
  language: propLanguage,
  t: propT,
  onDismiss,
  onLinked,
  className = '',
  variant = 'card',
}: TelegramLinkPromptProps) {
  const { signInWithTelegram, isTelegramUser } = useAuth();
  const [isLinking, setIsLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  const language = propLanguage || 'ru';
  const t = propT || ((key: keyof typeof translations.en) => i18n_t(key, language));

  // Don't show if user is already a Telegram user or dismissed
  if (isTelegramUser || isDismissed) {
    return null;
  }

  const handleTelegramAuth = useCallback(
    async (telegramData: TelegramAuthData) => {
      setIsLinking(true);
      setError(null);
      try {
        await signInWithTelegram(telegramData);
        onLinked?.();
      } catch (err) {
        console.error('Telegram linking error:', err);
        const errorMessage = err instanceof Error ? err.message : t('auth.telegram.failed');
        setError(errorMessage);
      } finally {
        setIsLinking(false);
      }
    },
    [signInWithTelegram, onLinked, t]
  );

  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
    // Store dismissal in localStorage to prevent showing again in this session
    localStorage.setItem('telegramLinkPromptDismissed', 'true');
    onDismiss?.();
  }, [onDismiss]);

  // Benefits list with icons
  const benefits = [
    { icon: <BellIcon />, text: t('linkTelegram.benefit1') },
    { icon: <MessageIcon />, text: t('linkTelegram.benefit2') },
    { icon: <CreditCardIcon />, text: t('linkTelegram.benefit3') },
  ];

  // Inline variant - compact banner
  if (variant === 'inline') {
    return (
      <div
        className={`flex items-center gap-4 p-4 bg-accent/50 border border-border rounded-lg ${className}`}
      >
        <TelegramIcon />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{t('linkTelegram.title')}</p>
          <p className="text-xs text-muted-foreground truncate">{t('linkTelegram.description')}</p>
        </div>
        <TelegramLoginButton onAuth={handleTelegramAuth} size="small" radius={6} />
        {onDismiss && (
          <button
            onClick={handleDismiss}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    );
  }

  // Card variant - full featured card
  return (
    <div
      className={`relative p-6 bg-card border border-border rounded-xl shadow-sm ${className}`}
    >
      {/* Dismiss button */}
      {onDismiss && (
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-colors"
          aria-label="Dismiss"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-[#0088cc]/10 rounded-lg">
          <TelegramIcon />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">{t('linkTelegram.title')}</h3>
          <p className="text-sm text-muted-foreground">{t('linkTelegram.description')}</p>
        </div>
      </div>

      {/* Benefits list */}
      <ul className="space-y-3 mb-6">
        {benefits.map((benefit, index) => (
          <li key={index} className="flex items-center gap-3">
            {benefit.icon}
            <span className="text-sm text-foreground">{benefit.text}</span>
          </li>
        ))}
      </ul>

      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm text-center">
          {error}
        </div>
      )}

      {/* Telegram Login Button */}
      <div className="flex justify-center">
        {isLinking ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="w-5 h-5 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin" />
            <span className="text-sm">{t('chat.sending')}</span>
          </div>
        ) : (
          <TelegramLoginButton onAuth={handleTelegramAuth} size="large" radius={8} />
        )}
      </div>
    </div>
  );
}

/**
 * Default export for easier imports
 */
export default TelegramLinkPrompt;
