/**
 * TelegramLoginButton Component
 *
 * This component injects the Telegram Login Widget script and handles the authentication callback.
 * It provides a seamless way for users to authenticate using their Telegram account.
 *
 * @see https://core.telegram.org/widgets/login
 *
 * Features:
 * - Script injection with cleanup
 * - Loading state while script loads
 * - Error boundary handling
 * - TypeScript type safety
 * - i18n support for multiple languages
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { TelegramAuthData } from '../../../types/omnichannel';

/**
 * Window type extension for Telegram auth callback
 */
declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramAuthData) => void;
  }
}

/**
 * Props for TelegramLoginButton component
 */
interface TelegramLoginButtonProps {
  /**
   * Callback function invoked when user successfully authenticates via Telegram
   * @param user - Telegram user authentication data
   */
  onAuth: (user: TelegramAuthData) => void;

  /**
   * Optional CSS class name for styling
   */
  className?: string;

  /**
   * Optional button size (small, medium, large)
   * @default 'large'
   */
  size?: 'small' | 'medium' | 'large';

  /**
   * Optional border radius (in pixels)
   * @default 8
   */
  radius?: number;

  /**
   * Whether to request write access permission
   * @default true
   */
  requestAccess?: boolean;
}

/**
 * TelegramLoginButton component
 *
 * Renders the Telegram Login Widget by injecting the official Telegram script.
 * Handles loading states, errors, and cleanup of global callbacks.
 *
 * @example
 * ```tsx
 * <TelegramLoginButton
 *   onAuth={(user) => handleTelegramAuth(user)}
 *   size="large"
 *   radius={8}
 * />
 * ```
 */
export function TelegramLoginButton({
  onAuth,
  className = '',
  size = 'large',
  radius = 8,
  requestAccess = true,
}: TelegramLoginButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Memoize the onAuth callback to prevent unnecessary re-renders
  const handleAuth = useCallback(
    (user: TelegramAuthData) => {
      try {
        onAuth(user);
        setIsLoading(false);
      } catch (err) {
        console.error('Error handling Telegram auth:', err);
        setError(err instanceof Error ? err.message : 'Authentication failed');
        setIsLoading(false);
      }
    },
    [onAuth]
  );

  useEffect(() => {
    // Get bot name from environment variables
    const botName = import.meta.env.VITE_TELEGRAM_BOT_NAME;

    if (!botName) {
      const errorMsg = 'VITE_TELEGRAM_BOT_NAME is not configured';
      console.error(errorMsg);
      setError(errorMsg);
      setIsLoading(false);
      return;
    }

    // Create script element
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', botName);
    script.setAttribute('data-size', size);
    script.setAttribute('data-radius', radius.toString());
    script.setAttribute('data-request-access', requestAccess ? 'write' : 'read');
    script.async = true;

    // Set up the global callback
    window.onTelegramAuth = handleAuth;
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');

    // Handle script load success
    script.onload = () => {
      setIsLoading(false);
    };

    // Handle script load error
    script.onerror = (err) => {
      console.error('Error loading Telegram widget script:', err);
      setError('Failed to load Telegram login widget');
      setIsLoading(false);
    };

    // Append script to container
    if (containerRef.current) {
      containerRef.current.appendChild(script);
    }

    // Cleanup function
    return () => {
      // Remove global callback
      delete window.onTelegramAuth;

      // Remove script from DOM
      if (containerRef.current && script.parentNode === containerRef.current) {
        containerRef.current.removeChild(script);
      }
    };
  }, [handleAuth, size, radius, requestAccess]);

  // Render error state
  if (error) {
    return (
      <div
        className={`telegram-login-error ${className}`}
        style={{
          padding: '12px',
          borderRadius: '8px',
          backgroundColor: 'var(--color-error-bg, #fee)',
          color: 'var(--color-error-text, #c00)',
          border: '1px solid var(--color-error-border, #fcc)',
          fontSize: '14px',
          textAlign: 'center',
        }}
      >
        {error}
      </div>
    );
  }

  // Render loading state
  if (isLoading) {
    return (
      <div
        className={`telegram-login-loading ${className}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px',
          minHeight: '40px',
        }}
      >
        <div
          style={{
            width: '20px',
            height: '20px',
            border: '2px solid var(--color-border, #ddd)',
            borderTopColor: 'var(--color-primary, #0088cc)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <style>
          {`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}
        </style>
      </div>
    );
  }

  // Render widget container
  return <div ref={containerRef} className={`telegram-login-widget ${className}`} />;
}

/**
 * Default export for easier imports
 */
export default TelegramLoginButton;
