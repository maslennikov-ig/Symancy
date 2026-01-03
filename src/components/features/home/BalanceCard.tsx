/**
 * BalanceCard Component
 *
 * Displays user's credit balance summary with Basic and Cassandra credits.
 * Provides a "Top Up" button to navigate to credits purchase page.
 *
 * @module components/features/home/BalanceCard
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../../ui/card';
import { Button } from '../../ui/button';
import { LoaderIcon } from '../../icons/LoaderIcon';
import { getUserCredits } from '../../../services/paymentService';
import { UserCredits } from '../../../types/payment';
import { cn } from '../../../lib/utils';
import type { Lang } from '../../../lib/i18n';

interface BalanceCardProps {
  /** Translation function */
  t: (key: string) => string;
  /** Current language for localized number formatting */
  language: Lang;
  /** Optional className for container */
  className?: string;
}

/**
 * Localized thousand suffixes for each supported language
 * Exported for testing purposes
 */
export const THOUSAND_SUFFIX: Record<Lang, string> = {
  en: 'K',
  ru: 'тыс',
  zh: '千',
};

/**
 * Format credit number for display with localized suffix
 * - Numbers >= 100000: show as "999K+" / "999тыс+" / "999千+"
 * - Numbers >= 10000: show as "10K" / "10тыс" / "10千"
 * - Otherwise: show full number
 *
 * @param num - The credit number to format
 * @param lang - The language for localized suffix (defaults to 'en')
 */
export function formatCredits(num: number, lang: Lang = 'en'): string {
  const suffix = THOUSAND_SUFFIX[lang] || THOUSAND_SUFFIX.en;

  if (num >= 100000) {
    return `${Math.floor(num / 1000)}${suffix}+`;
  }
  if (num >= 10000) {
    return `${Math.floor(num / 1000)}${suffix}`;
  }
  return num.toString();
}

/**
 * Get font size class based on number length
 */
export function getCreditsFontSize(num: number): string {
  if (num >= 10000) return 'text-lg';
  if (num >= 1000) return 'text-xl';
  return 'text-2xl';
}

/**
 * BalanceCard - Compact credit balance display for Home dashboard
 */
function BalanceCardComponent({ t, language, className }: BalanceCardProps) {
  const navigate = useNavigate();
  const [credits, setCredits] = useState<UserCredits | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCredits() {
      try {
        setLoading(true);
        setError(null);
        const result = await getUserCredits();
        setCredits(result);
      } catch (err) {
        console.error('Failed to fetch credits:', err);
        setError(err instanceof Error ? err.message : 'Error');
      } finally {
        setLoading(false);
      }
    }

    fetchCredits();
  }, []);

  const handleTopUp = () => {
    navigate('/pricing');
  };

  // Loading state
  if (loading) {
    return (
      <Card className={cn('w-full', className)}>
        <CardContent className="py-6 flex items-center justify-center">
          <LoaderIcon className="h-5 w-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={cn('w-full', className)}>
        <CardContent className="py-4">
          <p className="text-sm text-destructive text-center">{error}</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate totals
  const basicTotal = credits?.basic_credits ?? 0;
  const proTotal = credits?.pro_credits ?? 0;
  const cassandraTotal = credits?.cassandra_credits ?? 0;

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center justify-between">
          <span>{t('home.balance')}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="flex items-center justify-around gap-2 sm:gap-4">
          {/* Basic Credits */}
          <div className="flex flex-col items-center min-w-0">
            <div className="flex items-center gap-1 sm:gap-1.5 mb-1">
              <span className="text-lg sm:text-xl">&#11088;</span>
              <span className={cn(getCreditsFontSize(basicTotal), 'font-bold')} title={basicTotal.toString()}>
                {formatCredits(basicTotal, language)}
              </span>
            </div>
            <span className="text-xs text-muted-foreground truncate">{t('credits.type.basic')}</span>
          </div>

          {/* Divider */}
          <div className="h-10 w-px bg-border flex-shrink-0" />

          {/* PRO Credits */}
          <div className="flex flex-col items-center min-w-0">
            <div className="flex items-center gap-1 sm:gap-1.5 mb-1">
              <span className="text-lg sm:text-xl">&#127775;</span>
              <span className={cn(getCreditsFontSize(proTotal), 'font-bold')} title={proTotal.toString()}>
                {formatCredits(proTotal, language)}
              </span>
            </div>
            <span className="text-xs text-muted-foreground truncate">{t('credits.type.pro')}</span>
          </div>

          {/* Divider */}
          <div className="h-10 w-px bg-border flex-shrink-0" />

          {/* Cassandra Credits */}
          <div className="flex flex-col items-center min-w-0">
            <div className="flex items-center gap-1 sm:gap-1.5 mb-1">
              <span className="text-lg sm:text-xl">&#128142;</span>
              <span className={cn(getCreditsFontSize(cassandraTotal), 'font-bold')} title={cassandraTotal.toString()}>
                {formatCredits(cassandraTotal, language)}
              </span>
            </div>
            <span className="text-xs text-muted-foreground truncate">{t('credits.type.cassandra')}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-0">
        <Button onClick={handleTopUp} variant="outline" size="sm" className="w-full">
          {t('home.topUp')}
        </Button>
      </CardFooter>
    </Card>
  );
}

export const BalanceCard = React.memo(BalanceCardComponent);
