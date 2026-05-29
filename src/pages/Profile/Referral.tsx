/**
 * Referral Page - Referral program
 *
 * Shows the user's referral code and link, lets them copy/share it, and
 * displays aggregated referral stats. Located at /profile/referral.
 *
 * Mirrors the structure and styling of Profile/Credits.tsx (sticky header,
 * Card/Button primitives, CSS-variable theming, loading/error states).
 *
 * @module pages/Profile/Referral
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useTelegramWebApp } from '../../hooks/useTelegramWebApp';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { LoaderIcon } from '../../components/icons/LoaderIcon';
import { translations, Lang } from '../../lib/i18n';
import { getReferralInfo, type ReferralData } from '../../services/referralService';

// ============================================================================
// Types
// ============================================================================

interface ReferralProps {
  language: Lang;
  t: (key: keyof typeof translations.en) => string;
}

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

function CopyIcon(): React.ReactElement {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function ShareIcon(): React.ReactElement {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

// Used as the profile-row entry icon (exported for reuse in Profile.tsx).
export function ReferralIcon(): React.ReactElement {
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
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

// ============================================================================
// Subcomponents
// ============================================================================

/**
 * Single stat tile, matching the Profile statistics card style.
 */
function StatTile({ value, label }: { value: number; label: string }): React.ReactElement {
  return (
    <div
      style={{
        padding: '12px',
        borderRadius: '8px',
        backgroundColor: 'var(--tg-theme-secondary-bg-color, hsl(var(--accent)))',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: '24px',
          fontWeight: 700,
          color: 'var(--tg-theme-button-color, hsl(var(--primary)))',
          minHeight: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: '12px',
          color: 'var(--tg-theme-hint-color, hsl(var(--muted-foreground)))',
          marginTop: '4px',
        }}
      >
        {label}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Referral program page.
 */
export function Referral({ language: _language, t }: ReferralProps): React.ReactElement {
  const navigate = useNavigate();
  const { hapticFeedback, isWebApp, webApp } = useTelegramWebApp();

  // State
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch referral info on mount
  useEffect(() => {
    let active = true;

    async function fetchReferral() {
      try {
        setLoading(true);
        setError(null);
        const result = await getReferralInfo();
        if (!active) return;
        // The backend returns nulls if the code RPC failed transiently; without
        // a code/stats the page cannot function, so surface the error state
        // (a reload retries) rather than rendering a broken UI.
        if (!result.code || !result.stats) {
          setError(t('referral.error'));
        } else {
          setData(result);
        }
      } catch (err) {
        console.error('Failed to fetch referral info:', err);
        if (active) setError(err instanceof Error ? err.message : t('referral.error'));
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchReferral();
    return () => {
      active = false;
    };
    // Fetch once on mount; data is language-independent, so `t` is intentionally
    // omitted from deps to avoid a redundant re-fetch on language change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handlers
  const handleBack = useCallback(() => {
    hapticFeedback.impact('light');
    navigate(-1);
  }, [hapticFeedback, navigate]);

  const handleCopy = useCallback(async () => {
    if (!data?.link) return;
    hapticFeedback.impact('light');
    try {
      await navigator.clipboard.writeText(data.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy referral link:', err);
    }
  }, [data?.link, hapticFeedback]);

  const handleShare = useCallback(() => {
    if (!data?.link) return;
    hapticFeedback.impact('medium');
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(
      data.link
    )}&text=${encodeURIComponent(t('referral.inviteText'))}`;

    if (webApp?.openTelegramLink) {
      webApp.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, '_blank', 'noopener,noreferrer');
    }
  }, [data?.link, hapticFeedback, t, webApp]);

  // Stats tiles (only when data is available)
  const statTiles: { id: string; value: number; label: string }[] = data?.stats
    ? [
        { id: 'invited', value: data.stats.invited, label: t('referral.stats.invited') },
        { id: 'activated', value: data.stats.activated, label: t('referral.stats.activated') },
        { id: 'earned', value: data.stats.credits_earned, label: t('referral.stats.earned') },
        { id: 'pending', value: data.stats.pending, label: t('referral.stats.pending') },
      ]
    : [];

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
          {t('referral.title')}
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
                <span className="text-muted-foreground">{t('referral.loading')}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {error && !loading && (
          <Card>
            <CardContent className="py-8">
              <div className="text-center">
                <p className="text-destructive font-medium">{t('referral.error')}</p>
                <p className="text-muted-foreground text-sm mt-2">{error}</p>
                <Button onClick={() => window.location.reload()} className="mt-4">
                  {t('error.tryAgain')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Referral Display */}
        {data && !loading && !error && (
          <>
            {/* Subtitle */}
            <p
              style={{
                margin: '0 0 16px',
                fontSize: '14px',
                textAlign: 'center',
                color: 'var(--tg-theme-hint-color, hsl(var(--muted-foreground)))',
              }}
            >
              {t('referral.subtitle')}
            </p>

            {/* Code Card */}
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
                    {t('referral.yourCode')}
                  </p>
                  <p
                    style={{
                      fontSize: '32px',
                      fontWeight: 700,
                      letterSpacing: '2px',
                      color: 'var(--tg-theme-button-color, hsl(var(--primary)))',
                      lineHeight: 1.1,
                      wordBreak: 'break-all',
                    }}
                  >
                    {data.code}
                  </p>
                </div>

                {/* Actions — stacked full-width to avoid overflow on narrow
                    Telegram Mini App webviews (shadcn buttons are nowrap and the
                    RU labels are long, so a side-by-side row overflows). */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    marginTop: '20px',
                  }}
                >
                  <Button
                    onClick={handleCopy}
                    className="w-full"
                    variant={copied ? 'secondary' : 'default'}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <CopyIcon />
                      {copied ? t('referral.copied') : t('referral.copyLink')}
                    </span>
                  </Button>

                  {isWebApp && (
                    <Button onClick={handleShare} variant="outline" className="w-full">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <ShareIcon />
                        {t('referral.share')}
                      </span>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Stats */}
            <Card className="mb-4">
              <CardContent className="p-4">
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                  }}
                >
                  {statTiles.map((tile) => (
                    <div key={tile.id}>
                      <StatTile value={tile.value} label={tile.label} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* How it works */}
            <Card>
              <CardContent className="p-4">
                <h2
                  style={{
                    margin: '0 0 12px',
                    fontSize: '15px',
                    fontWeight: 600,
                    color: 'var(--tg-theme-text-color, hsl(var(--foreground)))',
                  }}
                >
                  {t('referral.how.title')}
                </h2>
                <ol
                  style={{
                    margin: 0,
                    paddingLeft: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    fontSize: '14px',
                    lineHeight: 1.5,
                    color: 'var(--tg-theme-text-color, hsl(var(--foreground)))',
                  }}
                >
                  <li>{t('referral.how.step1')}</li>
                  <li>{t('referral.how.step2')}</li>
                </ol>
                <p
                  style={{
                    margin: '12px 0 0',
                    fontSize: '13px',
                    color: 'var(--tg-theme-hint-color, hsl(var(--muted-foreground)))',
                  }}
                >
                  {t('referral.how.limit')}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

export default Referral;
