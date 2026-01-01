/**
 * Credits Page - User Credit Balance and Purchase
 *
 * Displays detailed credit balance and allows purchasing more credits.
 * Located at /profile/credits
 *
 * @module pages/Profile/Credits
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useTelegramWebApp } from '../../hooks/useTelegramWebApp';
import { useAuth } from '../../contexts/AuthContext';
import { getUserCredits } from '../../services/paymentService';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { LoaderIcon } from '../../components/icons/LoaderIcon';
import { translations, Lang } from '../../lib/i18n';
import type { UserCredits } from '../../types/payment';
import { cn } from '../../lib/utils';

// ============================================================================
// Types
// ============================================================================

interface CreditsProps {
  language: Lang;
  t: (key: keyof typeof translations.en) => string;
}

// ============================================================================
// Credit Type Config
// ============================================================================

const getCreditTypeConfig = (t: (key: string) => string) => ({
  basic: {
    labelKey: 'credits.type.basic',
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
        <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
        <line x1="6" x2="6" y1="2" y2="4" />
        <line x1="10" x2="10" y1="2" y2="4" />
        <line x1="14" x2="14" y1="2" y2="4" />
      </svg>
    ),
    badgeClass: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    iconBgClass: 'bg-green-500/20 text-green-600 dark:text-green-400',
    description: 'Basic coffee reading analysis',
  },
  pro: {
    labelKey: 'credits.type.pro',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
    badgeClass: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    iconBgClass: 'bg-purple-500/20 text-purple-600 dark:text-purple-400',
    description: 'PRO deep analysis with 6+ blocks',
  },
  cassandra: {
    labelKey: 'credits.type.cassandra',
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="4" />
        <line x1="4.93" y1="4.93" x2="9.17" y2="9.17" />
        <line x1="14.83" y1="14.83" x2="19.07" y2="19.07" />
        <line x1="14.83" y1="9.17" x2="19.07" y2="4.93" />
        <line x1="4.93" y1="19.07" x2="9.17" y2="14.83" />
      </svg>
    ),
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    iconBgClass: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
    description: 'Esoteric prediction by Cassandra',
  },
});

// ============================================================================
// Icon Components
// ============================================================================

function BackIcon(): React.ReactElement {
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
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Credits page - detailed credit balance view
 */
export function Credits({ language, t }: CreditsProps): React.ReactElement {
  const navigate = useNavigate();
  const { hapticFeedback, isWebApp } = useTelegramWebApp();
  const { user, unifiedUser } = useAuth();

  // State
  const [credits, setCredits] = useState<UserCredits | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch credits on mount
  useEffect(() => {
    async function fetchCredits() {
      try {
        setLoading(true);
        setError(null);
        const result = await getUserCredits();
        setCredits(result);
      } catch (err) {
        console.error('Failed to fetch credits:', err);
        setError(err instanceof Error ? err.message : t('credits.balance.error.default'));
      } finally {
        setLoading(false);
      }
    }

    fetchCredits();
  }, [t]);

  // Handlers
  const handleBack = useCallback(() => {
    hapticFeedback.impact('light');
    navigate(-1);
  }, [hapticFeedback, navigate]);

  const handleBuyCredits = useCallback(() => {
    hapticFeedback.impact('medium');
    navigate('/pricing');
  }, [hapticFeedback, navigate]);

  // Credit type config
  const creditTypeConfig = getCreditTypeConfig(t as (key: string) => string);

  // Credit types array
  const creditTypes = credits
    ? [
        { key: 'basic' as const, value: credits.basic_credits },
        { key: 'pro' as const, value: credits.pro_credits },
        { key: 'cassandra' as const, value: credits.cassandra_credits },
      ]
    : [];

  const totalCredits = credits
    ? credits.basic_credits + credits.pro_credits + credits.cassandra_credits
    : 0;

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--tg-theme-secondary-bg-color, hsl(var(--background)))',
        paddingBottom: '80px', // Space for BottomNav
      }}
    >
      {/* Header */}
      <header
        style={{
          backgroundColor: 'var(--tg-theme-bg-color, hsl(var(--card)))',
          borderBottom: '1px solid var(--tg-theme-hint-color, hsl(var(--border)))',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <button
          onClick={handleBack}
          style={{
            background: 'none',
            border: 'none',
            padding: '8px',
            margin: '-8px',
            cursor: 'pointer',
            color: 'var(--tg-theme-text-color, hsl(var(--foreground)))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="Back"
        >
          <BackIcon />
        </button>
        <h1
          style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: 600,
            color: 'var(--tg-theme-text-color, hsl(var(--foreground)))',
          }}
        >
          {t('credits.balance.title')}
        </h1>
      </header>

      {/* Content */}
      <div style={{ padding: '16px' }}>
        {/* Loading State */}
        {loading && (
          <Card>
            <CardContent className="py-12 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <LoaderIcon className="h-8 w-8 animate-spin text-primary" />
                <span className="text-muted-foreground">{t('credits.balance.loading')}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {error && !loading && (
          <Card>
            <CardContent className="py-8">
              <div className="text-center">
                <p className="text-destructive font-medium">{t('credits.balance.error.title')}</p>
                <p className="text-muted-foreground text-sm mt-2">{error}</p>
                <Button onClick={() => window.location.reload()} className="mt-4">
                  {t('error.tryAgain')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Credits Display */}
        {credits && !loading && !error && (
          <>
            {/* Total Balance Card */}
            <Card className="mb-4">
              <CardContent className="py-6">
                <div className="text-center">
                  <p
                    style={{
                      fontSize: '14px',
                      color: 'var(--tg-theme-hint-color, hsl(var(--muted-foreground)))',
                      marginBottom: '8px',
                    }}
                  >
                    {t('credits.balance.title')}
                  </p>
                  <p
                    style={{
                      fontSize: '48px',
                      fontWeight: 700,
                      color: 'var(--tg-theme-button-color, hsl(var(--primary)))',
                      lineHeight: 1,
                    }}
                  >
                    {totalCredits}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Credit Types Breakdown */}
            <Card>
              <CardContent className="py-4 space-y-3">
                {creditTypes.map(({ key, value }) => {
                  const config = creditTypeConfig[key];
                  return (
                    <div
                      key={key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        padding: '12px',
                        borderRadius: '12px',
                        backgroundColor: 'var(--tg-theme-secondary-bg-color, hsl(var(--accent)))',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div
                          className={cn(
                            'w-10 h-10 rounded-full flex items-center justify-center',
                            config.iconBgClass
                          )}
                        >
                          {config.icon}
                        </div>
                        <div>
                          <p
                            style={{
                              margin: 0,
                              fontWeight: 600,
                              fontSize: '15px',
                              color: 'var(--tg-theme-text-color, hsl(var(--foreground)))',
                            }}
                          >
                            {t(config.labelKey as keyof typeof translations.en)}
                          </p>
                          <p
                            style={{
                              margin: '2px 0 0',
                              fontSize: '12px',
                              color: 'var(--tg-theme-hint-color, hsl(var(--muted-foreground)))',
                            }}
                          >
                            {config.description}
                          </p>
                        </div>
                      </div>
                      <span
                        className={cn(
                          'px-4 py-2 text-lg font-bold rounded-full min-w-[3rem] text-center',
                          config.badgeClass
                        )}
                      >
                        {value}
                      </span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Buy More Button */}
            <Button onClick={handleBuyCredits} className="w-full mt-4" size="lg">
              {t('credits.balance.refill')}
            </Button>
          </>
        )}

        {/* Not authenticated */}
        {!credits && !loading && !error && (
          <Card>
            <CardContent className="py-8">
              <div className="text-center">
                <p className="text-muted-foreground">{t('credits.balance.signin')}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default Credits;
