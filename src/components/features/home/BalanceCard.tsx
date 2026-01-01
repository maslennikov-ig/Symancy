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

interface BalanceCardProps {
  /** Translation function */
  t: (key: string) => string;
  /** Optional className for container */
  className?: string;
}

/**
 * BalanceCard - Compact credit balance display for Home dashboard
 */
export function BalanceCard({ t, className }: BalanceCardProps) {
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
  const cassandraTotal = credits?.cassandra_credits ?? 0;

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center justify-between">
          <span>{t('home.balance')}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="flex items-center justify-around gap-4">
          {/* Basic Credits */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xl">&#11088;</span>
              <span className="text-2xl font-bold">{basicTotal}</span>
            </div>
            <span className="text-xs text-muted-foreground">{t('credits.type.basic')}</span>
          </div>

          {/* Divider */}
          <div className="h-10 w-px bg-border" />

          {/* Cassandra Credits */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xl">&#128142;</span>
              <span className="text-2xl font-bold">{cassandraTotal}</span>
            </div>
            <span className="text-xs text-muted-foreground">{t('credits.type.cassandra')}</span>
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
