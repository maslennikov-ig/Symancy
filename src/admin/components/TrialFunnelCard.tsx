import React, { useState, useEffect, useCallback } from 'react';
import { Users, BatteryWarning, ShoppingCart, TrendingUp, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminTranslations } from '../hooks/useAdminTranslations';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatsCard, StatsCardSkeleton } from './StatsCard';
import { formatNumber } from '../utils/formatters';

// ============================================================================
// Types
// ============================================================================

/**
 * Single-row contract of public.trial_conversion_funnel VIEW.
 * conversion_rate is a fraction in [0..1] or null.
 */
interface TrialFunnelRow {
  granted: number | null;
  exhausted: number | null;
  purchased: number | null;
  conversion_rate: number | null;
}

// ============================================================================
// Helpers
// ============================================================================

/** Render conversion_rate (0..1 or null) as a percentage string, null -> em dash. */
function formatConversion(rate: number | null): string {
  if (rate === null || rate === undefined || Number.isNaN(rate)) return '—';
  return `${(rate * 100).toFixed(1)}%`;
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * TrialFunnelCard — Trial → Paid conversion funnel widget.
 *
 * Reads the single-row VIEW public.trial_conversion_funnel via the standard
 * authenticated supabase client and renders granted / exhausted / purchased
 * counts plus the conversion rate as a percentage.
 */
export function TrialFunnelCard() {
  const { t } = useAdminTranslations();

  const [data, setData] = useState<TrialFunnelRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleRetry = useCallback(() => setRefreshTrigger((prev) => prev + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setIsLoading(true);
      setError(null);

      try {
        const { data: row, error: queryError } = await supabase
          .from('trial_conversion_funnel')
          .select('*')
          .maybeSingle();

        if (queryError) throw queryError;

        if (!cancelled) {
          setData((row as TrialFunnelRow | null) ?? null);
        }
      } catch (err) {
        console.error('Error fetching trial funnel:', err);
        const message = err instanceof Error ? err.message : 'Failed to fetch data';
        if (!cancelled) {
          setError(message);
          toast.error(t('admin.trialFunnel.fetchError'), { description: message });
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [refreshTrigger, t]);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            {t('admin.trialFunnel.title')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('admin.trialFunnel.description')}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRetry}
          disabled={isLoading}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          {t('admin.common.refresh')}
        </Button>
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={handleRetry} disabled={isLoading}>
              {t('admin.common.retry')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          <>
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
          </>
        ) : (
          <>
            <StatsCard
              title={t('admin.trialFunnel.granted')}
              value={formatNumber(data?.granted ?? 0)}
              icon={Users}
              variant="blue"
            />
            <StatsCard
              title={t('admin.trialFunnel.exhausted')}
              value={formatNumber(data?.exhausted ?? 0)}
              icon={BatteryWarning}
              variant="amber"
            />
            <StatsCard
              title={t('admin.trialFunnel.purchased')}
              value={formatNumber(data?.purchased ?? 0)}
              icon={ShoppingCart}
              variant="violet"
            />
            <StatsCard
              title={t('admin.trialFunnel.conversion')}
              value={formatConversion(data?.conversion_rate ?? null)}
              icon={TrendingUp}
              variant="emerald"
            />
          </>
        )}
      </div>
    </div>
  );
}

export default TrialFunnelCard;
