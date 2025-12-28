import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Button } from '../components/ui/button';
import { translations, t as i18n_t, Lang } from '../lib/i18n';
import { useAuth } from '../contexts/AuthContext';
import { LoaderIcon } from '../components/icons/LoaderIcon';

interface LinkProps {
  language?: Lang;
  t?: (key: keyof typeof translations.en) => string;
}

type LinkState = 'loading' | 'login_required' | 'no_token' | 'success' | 'error';

interface ErrorResponse {
  error?: string;
  message?: string;
}

/**
 * Link page - handles account linking from Telegram bot
 *
 * URL: /link?token=abc123...
 *
 * Flow:
 * 1. Extract token from URL params
 * 2. Check if user is logged in (needs JWT from AuthContext)
 * 3. Submit token to /api/auth/link endpoint
 * 4. Handle success/error states
 */
const Link: React.FC<LinkProps> = ({ language: propLanguage, t: propT }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, unifiedUser, session, loading: authLoading } = useAuth();

  // Fallback if props are not passed (though App.tsx should pass them)
  const language = propLanguage || 'en';
  const t = propT || ((key: any) => i18n_t(key, language));

  const [linkState, setLinkState] = useState<LinkState>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [linkedUserName, setLinkedUserName] = useState<string>('');

  // Get token from URL
  const token = searchParams.get('token');

  useEffect(() => {
    // Wait for auth to initialize
    if (authLoading) {
      return;
    }

    // Check if token exists
    if (!token) {
      setLinkState('no_token');
      return;
    }

    // Check if user is authenticated
    // User can be authenticated via Supabase (user) or Telegram (unifiedUser)
    const isAuthenticated = !!(user || unifiedUser);
    const jwt = session?.access_token;

    if (!isAuthenticated || !jwt) {
      setLinkState('login_required');
      return;
    }

    // Auto-submit token
    submitLinkToken(token, jwt);
  }, [token, authLoading, user, unifiedUser, session]);

  const submitLinkToken = async (linkToken: string, jwt: string) => {
    setLinkState('loading');
    setErrorMessage('');

    const API_BASE_URL = import.meta.env.VITE_API_URL || '';

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`,
        },
        body: JSON.stringify({ token: linkToken }),
      });

      if (!response.ok) {
        const errorData: ErrorResponse = await response.json().catch(() => ({}));

        // Handle specific error codes
        if (response.status === 400 && errorData.error === 'TOKEN_EXPIRED') {
          setErrorMessage(t('link.error.expired'));
        } else if (response.status === 409 && errorData.error === 'ACCOUNT_ALREADY_LINKED') {
          setErrorMessage(t('link.error.alreadyLinked'));
        } else {
          setErrorMessage(errorData.message || t('link.error.generic'));
        }

        setLinkState('error');
        return;
      }

      const result = await response.json();

      // Store linked user name for success message
      if (result.user?.telegram_username) {
        setLinkedUserName(result.user.telegram_username);
      }

      setLinkState('success');
    } catch (err) {
      console.error('Link error:', err);
      setErrorMessage(t('link.error.generic'));
      setLinkState('error');
    }
  };

  const handleGoHome = () => {
    navigate('/');
  };

  const handleLogin = () => {
    // Redirect to home page where login modal can be triggered
    navigate('/?login=true');
  };

  const handleRetry = () => {
    if (token && session?.access_token) {
      submitLinkToken(token, session.access_token);
    }
  };

  // Loading state
  if (linkState === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
        <div className="text-center max-w-md">
          <LoaderIcon className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">{t('link.loading')}</p>
        </div>
      </div>
    );
  }

  // No token error
  if (linkState === 'no_token') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6" role="img" aria-label="Error">
            <span className="inline-block">❌</span>
          </div>
          <h1 className="text-3xl font-bold mb-2 text-foreground">
            {t('link.error.noToken')}
          </h1>
          <p className="text-muted-foreground mb-8">
            {t('link.subtitle')}
          </p>
          <Button onClick={handleGoHome} size="lg" className="min-w-[200px]">
            {t('link.button.goHome')}
          </Button>
        </div>
      </div>
    );
  }

  // Login required
  if (linkState === 'login_required') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6" role="img" aria-label="Login">
            <span className="inline-block">🔐</span>
          </div>
          <h1 className="text-3xl font-bold mb-2 text-foreground">
            {t('link.error.loginRequired')}
          </h1>
          <p className="text-muted-foreground mb-8">
            {t('link.subtitle')}
          </p>
          <div className="flex gap-4 justify-center">
            <Button onClick={handleLogin} size="lg" variant="default">
              {t('link.button.login')}
            </Button>
            <Button onClick={handleGoHome} size="lg" variant="outline">
              {t('link.button.goHome')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (linkState === 'success') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
        <div className="text-center max-w-md">
          {/* Success checkmark */}
          <div className="text-6xl mb-6" role="img" aria-label="Success">
            <span className="inline-block animate-bounce">✅</span>
          </div>

          {/* Main heading */}
          <h1 className="text-3xl font-bold mb-2 text-foreground">
            {t('link.success.title')}
          </h1>

          {/* Confirmation message */}
          <p className="text-muted-foreground mb-8">
            {linkedUserName
              ? t('link.success.subtitle').replace('{username}', linkedUserName)
              : t('link.success.subtitle').replace(' @{username}', '')}
          </p>

          {/* Home button */}
          <Button onClick={handleGoHome} size="lg" className="min-w-[200px]">
            {t('link.button.goHome')}
          </Button>
        </div>
      </div>
    );
  }

  // Error state
  if (linkState === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
        <div className="text-center max-w-md">
          {/* Error icon */}
          <div className="text-6xl mb-6" role="img" aria-label="Error">
            <span className="inline-block">❌</span>
          </div>

          {/* Main heading */}
          <h1 className="text-3xl font-bold mb-2 text-destructive">
            {t('error.title')}
          </h1>

          {/* Error message */}
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-8">
            <p className="text-destructive font-medium">{errorMessage}</p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-4 justify-center">
            <Button onClick={handleRetry} size="lg" variant="default">
              {t('payment.error.retry')}
            </Button>
            <Button onClick={handleGoHome} size="lg" variant="outline">
              {t('link.button.goHome')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default Link;
