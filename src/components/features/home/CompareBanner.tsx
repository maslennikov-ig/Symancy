/**
 * CompareBanner Component
 *
 * Soft promo card for the Compare feature on the Home dashboard.
 * Displays a "New" badge, title, short description and a CTA button
 * that navigates to /compare.
 *
 * Styled to match other Home cards (Card wrapper, theme-aware tokens,
 * no harsh gradients) so it feels like a native part of the dashboard.
 *
 * @module components/features/home/CompareBanner
 */
import React from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { CompareIcon } from '../../icons';
import { cn } from '../../../lib/utils';
import { useTelegramWebApp } from '../../../hooks/useTelegramWebApp';

interface CompareBannerProps {
  /** Translation function */
  t: (key: string) => string;
  /** Optional className for container */
  className?: string;
}

/**
 * CompareBanner - Soft promo banner for the cup-comparison feature
 */
function CompareBannerComponent({ t, className }: CompareBannerProps) {
  const navigate = useNavigate();
  const { hapticFeedback } = useTelegramWebApp();

  const handleTry = () => {
    hapticFeedback.impact('light');
    navigate('/compare');
  };

  return (
    <Card
      className={cn(
        'w-full overflow-hidden border-primary/20 bg-card',
        className
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div
            className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0"
            aria-hidden="true"
          >
            <CompareIcon className="w-5 h-5 text-primary" size={20} />
          </div>

          {/* Text + CTA */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-semibold text-foreground leading-tight">
                {t('home.compareBanner.title')}
              </h3>
              <Badge
                variant="secondary"
                className="text-[10px] uppercase tracking-wide px-1.5 py-0"
              >
                {t('home.compareBanner.badge')}
              </Badge>
            </div>

            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              {t('home.compareBanner.description')}
            </p>

            <Button
              onClick={handleTry}
              variant="default"
              size="sm"
              className="mt-3"
              aria-label={t('home.compareBanner.cta')}
            >
              {t('home.compareBanner.cta')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export const CompareBanner = React.memo(CompareBannerComponent);
