import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { translations, t as i18n_t, Lang } from '../../lib/i18n';
import { useAuth } from '../../contexts/AuthContext';
import { LinkLoading } from './LinkLoading';
import { LinkNoToken } from './LinkNoToken';
import { LinkLoginRequired } from './LinkLoginRequired';
import { LinkSuccess } from './LinkSuccess';
import { LinkError } from './LinkError';

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
    } catch {
      // LOW-1 fix: Remove console.error as we already handle error via state
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

  // LOW-4 fix: Use extracted components for each state
  switch (linkState) {
    case 'loading':
      return <LinkLoading t={t} />;
    case 'no_token':
      return <LinkNoToken t={t} onGoHome={handleGoHome} />;
    case 'login_required':
      return <LinkLoginRequired t={t} onLogin={handleLogin} onGoHome={handleGoHome} />;
    case 'success':
      return <LinkSuccess t={t} linkedUserName={linkedUserName} onGoHome={handleGoHome} />;
    case 'error':
      return <LinkError t={t} errorMessage={errorMessage} onRetry={handleRetry} onGoHome={handleGoHome} />;
    default:
      return null;
  }
};

export default Link;
