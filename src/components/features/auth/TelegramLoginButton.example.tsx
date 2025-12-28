/**
 * TelegramLoginButton Usage Examples
 *
 * This file demonstrates various ways to use the TelegramLoginButton component.
 */

import { TelegramLoginButton } from './TelegramLoginButton';
import type { TelegramAuthData } from '../../../types/omnichannel';

/**
 * Example 1: Basic usage
 */
export function BasicExample() {
  const handleTelegramAuth = async (user: TelegramAuthData) => {
    console.log('Telegram user authenticated:', user);
    // Handle authentication logic here
  };

  return (
    <div>
      <h2>Login with Telegram</h2>
      <TelegramLoginButton onAuth={handleTelegramAuth} />
    </div>
  );
}

/**
 * Example 2: With custom styling
 */
export function CustomStyledExample() {
  const handleTelegramAuth = async (user: TelegramAuthData) => {
    // Send to backend for verification
    const response = await fetch('/api/auth/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });

    const { token } = await response.json();
    localStorage.setItem('auth_token', token);
    window.location.href = '/dashboard';
  };

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', padding: '20px' }}>
      <h2 style={{ marginBottom: '20px', textAlign: 'center' }}>
        Connect Your Telegram Account
      </h2>
      <TelegramLoginButton
        onAuth={handleTelegramAuth}
        className="custom-telegram-button"
        size="large"
        radius={12}
      />
    </div>
  );
}

/**
 * Example 3: With error handling and loading state
 */
export function FullFeaturedExample() {
  const handleTelegramAuth = async (user: TelegramAuthData) => {
    try {
      // Verify auth data with backend
      const response = await fetch('/api/auth/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
      });

      if (!response.ok) {
        throw new Error('Authentication failed');
      }

      const { token, user: userData } = await response.json();

      // Store token
      localStorage.setItem('symancy_token', token);

      // Update UI
      console.log('Authenticated user:', userData);

      // Redirect to app
      window.location.href = '/';
    } catch (error) {
      console.error('Telegram auth error:', error);
      alert('Failed to authenticate. Please try again.');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-background)',
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          padding: '40px',
          borderRadius: '16px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          maxWidth: '400px',
          width: '100%',
        }}
      >
        <h1 style={{ marginBottom: '12px', fontSize: '24px', fontWeight: 'bold' }}>
          Welcome to Symancy
        </h1>
        <p
          style={{
            marginBottom: '24px',
            color: 'var(--color-text-secondary)',
            fontSize: '14px',
          }}
        >
          Sign in with Telegram to access all features
        </p>

        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>Benefits:</h3>
          <ul style={{ paddingLeft: '20px', fontSize: '14px' }}>
            <li style={{ marginBottom: '8px' }}>Notifications and reminders</li>
            <li style={{ marginBottom: '8px' }}>Messages even when offline</li>
            <li style={{ marginBottom: '8px' }}>Shared credits across channels</li>
          </ul>
        </div>

        <TelegramLoginButton
          onAuth={handleTelegramAuth}
          size="large"
          radius={8}
          requestAccess={true}
        />

        <p
          style={{
            marginTop: '20px',
            fontSize: '12px',
            color: 'var(--color-text-secondary)',
            textAlign: 'center',
          }}
        >
          By signing in, you agree to our Terms of Service
        </p>
      </div>
    </div>
  );
}

/**
 * Example 4: Integration with i18n
 */
export function I18nExample() {
  const handleTelegramAuth = async (user: TelegramAuthData) => {
    // Handle auth
    console.log('User authenticated:', user);
  };

  // In real app, this would come from i18n context
  const t = (key: string) => {
    const translations: Record<string, string> = {
      'auth.title': 'Connect Telegram',
      'auth.subtitle': 'Get full access to all features',
      'auth.benefit1': 'Notifications and reminders',
      'auth.benefit2': 'Messages even when offline',
      'auth.benefit3': 'Shared credits across channels',
    };
    return translations[key] || key;
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>{t('auth.title')}</h2>
      <p>{t('auth.subtitle')}</p>
      <TelegramLoginButton onAuth={handleTelegramAuth} />
    </div>
  );
}
