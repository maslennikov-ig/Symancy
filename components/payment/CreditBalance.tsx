import React, { useEffect, useState } from 'react';
import { getUserCredits } from '../../services/paymentService';
import { UserCredits } from '../../types/payment';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { LoaderIcon } from '../LoaderIcon';
import { cn } from '../../lib/utils';

/**
 * Credit type configuration with icons and styles
 */
const creditTypeConfig = {
  basic: {
    label: 'Базовые',
    icon: (
      <svg
        className="w-4 h-4"
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
  },
  pro: {
    label: 'PRO',
    icon: (
      <svg
        className="w-4 h-4"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
    badgeClass: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    iconBgClass: 'bg-purple-500/20 text-purple-600 dark:text-purple-400',
  },
  cassandra: {
    label: 'Кассандра',
    icon: (
      <svg
        className="w-4 h-4"
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
  },
} as const;

interface CreditBalanceProps {
  /** Callback when user clicks "Пополнить" button */
  onBuyCredits?: () => void;
  /** Optional className for container */
  className?: string;
}

export function CreditBalance({ onBuyCredits, className }: CreditBalanceProps) {
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
        setError(err instanceof Error ? err.message : 'Ошибка загрузки баланса');
      } finally {
        setLoading(false);
      }
    }

    fetchCredits();
  }, []);

  // Loading state
  if (loading) {
    return (
      <Card className={cn('w-full', className)}>
        <CardContent className="py-8 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <LoaderIcon className="h-6 w-6 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Загрузка баланса...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={cn('w-full', className)}>
        <CardContent className="py-6">
          <div className="text-center text-destructive">
            <p className="font-medium">Ошибка</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No credits data
  if (!credits) {
    return (
      <Card className={cn('w-full', className)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Ваши кредиты</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Войдите в аккаунт, чтобы увидеть баланс
          </p>
        </CardContent>
      </Card>
    );
  }

  const creditTypes = [
    { key: 'basic' as const, value: credits.basic_credits },
    { key: 'pro' as const, value: credits.pro_credits },
    { key: 'cassandra' as const, value: credits.cassandra_credits },
  ];

  const totalCredits = credits.basic_credits + credits.pro_credits + credits.cassandra_credits;

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Ваши кредиты</span>
          <span className="text-2xl font-bold text-primary">{totalCredits}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {creditTypes.map(({ key, value }) => {
          const config = creditTypeConfig[key];
          return (
            <div
              key={key}
              className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center',
                    config.iconBgClass
                  )}
                >
                  {config.icon}
                </div>
                <span className="font-medium">{config.label}</span>
              </div>
              <span
                className={cn(
                  'px-3 py-1 text-sm font-bold rounded-full min-w-[2.5rem] text-center',
                  config.badgeClass
                )}
              >
                {value}
              </span>
            </div>
          );
        })}
      </CardContent>
      {onBuyCredits && (
        <CardFooter>
          <Button onClick={onBuyCredits} className="w-full">
            Пополнить
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
