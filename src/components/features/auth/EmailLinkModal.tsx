/**
 * EmailLinkModal Component
 *
 * A modal component for Telegram users to link their email address.
 * Uses Supabase magic link for email verification combined with backend link token.
 *
 * Features:
 * - Email input with validation
 * - Send link button with loading state
 * - Success state with check-your-email instructions
 * - Error handling and display
 * - i18n support for all 3 languages (ru, en, zh)
 * - Respects Telegram theme CSS variables
 *
 * @see tasks.md - Email linking for Telegram users
 */

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/card';
import { useTelegramWebApp } from '../../../hooks/useTelegramWebApp';
import { requestEmailLink } from '../../../services/authService';
import { translations, Lang, t as i18n_t } from '../../../lib/i18n';

/**
 * Email validation regex
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Props for EmailLinkModal component
 */
interface EmailLinkModalProps {
  /**
   * Whether the modal is open
   */
  isOpen: boolean;

  /**
   * Callback to close the modal
   */
  onClose: () => void;

  /**
   * JWT token for authenticated Telegram user
   */
  telegramToken: string;

  /**
   * Current language for translations
   * @default 'ru'
   */
  language?: Lang;

  /**
   * Translation function (optional, will use default if not provided)
   */
  t?: (key: keyof typeof translations.en) => string;

  /**
   * Callback when email link is successfully sent
   */
  onSuccess?: () => void;
}

/**
 * Close icon SVG component
 */
function CloseIcon(): React.ReactElement {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/**
 * Email icon SVG component
 */
function EmailIcon(): React.ReactElement {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

/**
 * Check circle icon SVG component for success state
 */
function CheckCircleIcon(): React.ReactElement {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

/**
 * EmailLinkModal component
 *
 * Allows Telegram users to link their email for account merging.
 * Sends a magic link via Supabase with a link token from the backend.
 *
 * @example
 * ```tsx
 * <EmailLinkModal
 *   isOpen={showEmailModal}
 *   onClose={() => setShowEmailModal(false)}
 *   telegramToken={token}
 *   language="ru"
 * />
 * ```
 */
export function EmailLinkModal({
  isOpen,
  onClose,
  telegramToken,
  language: propLanguage,
  t: propT,
  onSuccess,
}: EmailLinkModalProps): React.ReactElement | null {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const { hapticFeedback } = useTelegramWebApp();
  const language = propLanguage || 'ru';
  const t = propT || ((key: keyof typeof translations.en) => i18n_t(key, language));

  /**
   * Validate email format
   */
  const isValidEmail = useCallback((value: string): boolean => {
    return EMAIL_REGEX.test(value);
  }, []);

  /**
   * Handle email input change
   */
  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    setError(null); // Clear error on input change
  }, []);

  /**
   * Handle send link button click
   */
  const handleSendLink = useCallback(async () => {
    // Validate email
    if (!isValidEmail(email)) {
      setError(t('emailLink.error.invalidEmail'));
      hapticFeedback.notification('error');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await requestEmailLink(telegramToken, email);
      setIsSuccess(true);
      hapticFeedback.notification('success');
      onSuccess?.();
    } catch (err) {
      console.error('Email link error:', err);
      const errorMessage = err instanceof Error ? err.message : t('emailLink.error.generic');
      setError(errorMessage);
      hapticFeedback.notification('error');
    } finally {
      setIsLoading(false);
    }
  }, [email, isValidEmail, telegramToken, t, hapticFeedback, onSuccess]);

  /**
   * Handle modal close
   */
  const handleClose = useCallback(() => {
    hapticFeedback.impact('light');
    // Reset state when closing
    setEmail('');
    setError(null);
    setIsSuccess(false);
    setIsLoading(false);
    onClose();
  }, [hapticFeedback, onClose]);

  /**
   * Handle key press (Enter to submit)
   */
  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !isLoading) {
        handleSendLink();
      }
    },
    [handleSendLink, isLoading]
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
      onClick={handleClose}
    >
      <Card
        style={{
          maxWidth: '400px',
          width: '100%',
          backgroundColor: 'var(--tg-theme-bg-color, hsl(var(--card)))',
          border: '1px solid var(--tg-theme-hint-color, hsl(var(--border)))',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with close button */}
        <CardHeader style={{ position: 'relative', paddingBottom: '12px' }}>
          <button
            onClick={handleClose}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              padding: '4px',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--tg-theme-hint-color, hsl(var(--muted-foreground)))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
            }}
            aria-label="Close"
          >
            <CloseIcon />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                padding: '8px',
                backgroundColor: 'var(--tg-theme-button-color, hsl(var(--primary)))',
                borderRadius: '8px',
                color: 'var(--tg-theme-button-text-color, hsl(var(--primary-foreground)))',
                opacity: 0.9,
              }}
            >
              <EmailIcon />
            </div>
            <div>
              <CardTitle
                style={{
                  fontSize: '18px',
                  color: 'var(--tg-theme-text-color, hsl(var(--foreground)))',
                }}
              >
                {t('emailLink.title')}
              </CardTitle>
              <CardDescription
                style={{
                  fontSize: '13px',
                  marginTop: '4px',
                  color: 'var(--tg-theme-hint-color, hsl(var(--muted-foreground)))',
                }}
              >
                {t('emailLink.description')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent style={{ paddingTop: '0' }}>
          {isSuccess ? (
            /* Success state */
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                padding: '24px 0',
              }}
            >
              <div
                style={{
                  color: 'var(--tg-theme-button-color, hsl(var(--primary)))',
                  marginBottom: '16px',
                }}
              >
                <CheckCircleIcon />
              </div>
              <h3
                style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: 'var(--tg-theme-text-color, hsl(var(--foreground)))',
                  marginBottom: '8px',
                }}
              >
                {t('emailLink.success.title')}
              </h3>
              <p
                style={{
                  fontSize: '14px',
                  color: 'var(--tg-theme-hint-color, hsl(var(--muted-foreground)))',
                  lineHeight: 1.5,
                }}
              >
                {t('emailLink.success.description')}
              </p>
              <button
                onClick={handleClose}
                style={{
                  marginTop: '24px',
                  padding: '10px 24px',
                  backgroundColor: 'var(--tg-theme-button-color, hsl(var(--primary)))',
                  color: 'var(--tg-theme-button-text-color, hsl(var(--primary-foreground)))',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                }}
              >
                OK
              </button>
            </div>
          ) : (
            /* Input form */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Email input */}
              <div>
                <input
                  type="email"
                  value={email}
                  onChange={handleEmailChange}
                  onKeyPress={handleKeyPress}
                  placeholder={t('emailLink.input.placeholder')}
                  disabled={isLoading}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: `1px solid ${error ? 'hsl(var(--destructive))' : 'var(--tg-theme-hint-color, hsl(var(--border)))'}`,
                    backgroundColor: 'var(--tg-theme-secondary-bg-color, hsl(var(--background)))',
                    color: 'var(--tg-theme-text-color, hsl(var(--foreground)))',
                    fontSize: '15px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Error message */}
              {error && (
                <p
                  style={{
                    fontSize: '13px',
                    color: 'hsl(var(--destructive))',
                    margin: 0,
                  }}
                >
                  {error}
                </p>
              )}

              {/* Send button */}
              <button
                onClick={handleSendLink}
                disabled={isLoading || !email.trim()}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  backgroundColor:
                    isLoading || !email.trim()
                      ? 'var(--tg-theme-hint-color, hsl(var(--muted)))'
                      : 'var(--tg-theme-button-color, hsl(var(--primary)))',
                  color:
                    isLoading || !email.trim()
                      ? 'var(--tg-theme-hint-color, hsl(var(--muted-foreground)))'
                      : 'var(--tg-theme-button-text-color, hsl(var(--primary-foreground)))',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: '500',
                  cursor: isLoading || !email.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                {isLoading ? (
                  <>
                    <div
                      style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid transparent',
                        borderTopColor: 'currentColor',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                      }}
                    />
                    {t('chat.sending')}
                  </>
                ) : (
                  t('emailLink.button.send')
                )}
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Keyframes for spinner animation */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

/**
 * Default export for easier imports
 */
export default EmailLinkModal;
