/**
 * LowCreditBanner Component
 *
 * Soft nudge card shown on the Home dashboard when the user's total credit
 * balance is low (1 left) or depleted (0 left). Encourages topping up with a
 * CTA that navigates to /pricing.
 *
 * Mirrors CompareBanner in structure and styling (Card wrapper, theme-aware
 * tokens, no harsh gradients) so it feels native to the dashboard. Loads the
 * balance itself via getUserCredits() — the same source BalanceCard uses.
 *
 * Visibility rules:
 *  - while loading, on error, or when total > 1  -> renders null (hidden)
 *  - total === 1 -> "low" tone (running out)
 *  - total === 0 -> "zero" tone (depleted)
 *
 * @module components/features/home/LowCreditBanner
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { AlertCircleIcon } from '../../icons';
import { getUserCredits } from '../../../services/paymentService';
import type { UserCredits } from '../../../types/payment';
import { cn } from '../../../lib/utils';
import { useTelegramWebApp } from '../../../hooks/useTelegramWebApp';

interface LowCreditBannerProps {
  /** Translation function */
  t: (key: string) => string;
  /** Optional className for container */
  className?: string;
}

/**
 * LowCreditBanner - Soft top-up nudge for low/zero credit balance
 */
function LowCreditBannerComponent({ t, className }: LowCreditBannerProps) {
  const navigate = useNavigate();
  const { hapticFeedback } = useTelegramWebApp();

  const [credits, setCredits] = useState<UserCredits | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;

    async function fetchCredits() {
      try {
        setLoading(true);
        setError(false);
        const result = await getUserCredits();
        if (active) setCredits(result);
      } catch (err) {
        console.error('LowCreditBanner: failed to fetch credits:', err);
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchCredits();

    return () => {
      active = false;
    };
  }, []);

  // Hidden while loading or on error — never block the dashboard.
  if (loading || error) {
    return null;
  }

  const total =
    (credits?.basic_credits ?? 0) +
    (credits?.pro_credits ?? 0) +
    (credits?.cassandra_credits ?? 0);

  // Only nudge when the balance is low (1) or depleted (0).
  if (total > 1) {
    return null;
  }

  const isZero = total === 0;

  const handleTopUp = () => {
    hapticFeedback.impact('light');
    navigate('/pricing');
  };

  return (
    <Card
      className={cn(
        'w-full overflow-hidden bg-card',
        isZero ? 'border-destructive/30' : 'border-primary/20',
        className
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
              isZero ? 'bg-destructive/10' : 'bg-primary/10'
            )}
            aria-hidden="true"
          >
            <AlertCircleIcon
              className={cn('w-5 h-5', isZero ? 'text-destructive' : 'text-primary')}
              size={20}
            />
          </div>

          {/* Text + CTA */}
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-foreground leading-tight">
              {isZero
                ? t('home.lowCreditBanner.titleZero')
                : t('home.lowCreditBanner.titleLow')}
            </h3>

            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              {t('home.lowCreditBanner.description')}
            </p>

            <Button
              onClick={handleTopUp}
              variant="default"
              size="sm"
              className="mt-3"
              aria-label={t('home.lowCreditBanner.cta')}
            >
              {t('home.lowCreditBanner.cta')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export const LowCreditBanner = React.memo(LowCreditBannerComponent);
