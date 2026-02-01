import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { XCircle, AlertTriangle, TrendingDown, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useAdminTranslations } from '../hooks/useAdminTranslations';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { StatsCard, StatsCardSkeleton } from './StatsCard';
import { ChartCard } from './ChartCard';
import { formatNumber, formatNumberEN } from '../utils/formatters';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import type { CancellationReason } from '@/types/payment';

// ============================================================================
// Types
// ============================================================================

interface CancellationReasonData {
  reason: CancellationReason;
  count: number;
  label: string;
  [key: string]: string | number; // Index signature for Recharts compatibility
}

interface CancellationStats {
  totalCanceled: number;
  totalSucceeded: number;
  cancellationRate: number;
  mostCommonReason: string | null;
  reasonBreakdown: CancellationReasonData[];
}

// ============================================================================
// Constants
// ============================================================================

// Chart colors for different reasons (using CSS variables)
const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

// Reason labels mapping (keys for i18n)
const REASON_I18N_KEYS: Record<CancellationReason, string> = {
  insufficient_funds: 'admin.cancellations.reason.insufficientFunds',
  card_expired: 'admin.cancellations.reason.cardExpired',
  invalid_card_number: 'admin.cancellations.reason.invalidCardNumber',
  invalid_csc: 'admin.cancellations.reason.invalidCsc',
  invalid_expiry_month: 'admin.cancellations.reason.invalidExpiryMonth',
  invalid_expiry_year: 'admin.cancellations.reason.invalidExpiryYear',
  fraud_suspected: 'admin.cancellations.reason.fraudSuspected',
  '3d_secure_failed': 'admin.cancellations.reason.3dSecureFailed',
  general_decline: 'admin.cancellations.reason.generalDecline',
  processing_error: 'admin.cancellations.reason.processingError',
  canceled_by_merchant: 'admin.cancellations.reason.canceledByMerchant',
  permission_revoked: 'admin.cancellations.reason.permissionRevoked',
};

// ============================================================================
// Main Component
// ============================================================================

export function PaymentCancellationStats() {
  const { t, language } = useAdminTranslations();

  // Data state
  const [stats, setStats] = useState<CancellationStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleRetry = useCallback(() => setRefreshTrigger((prev) => prev + 1), []);

  // Fetch data from Supabase
  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch cancellation reasons breakdown
        const { data: reasonData, error: reasonError } = await supabase
          .from('purchases')
          .select('cancellation_reason')
          .eq('status', 'canceled')
          .not('cancellation_reason', 'is', null);

        if (reasonError) throw reasonError;

        // Fetch total canceled count
        const { count: canceledCount, error: canceledError } = await supabase
          .from('purchases')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'canceled');

        if (canceledError) throw canceledError;

        // Fetch total succeeded count
        const { count: succeededCount, error: succeededError } = await supabase
          .from('purchases')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'succeeded');

        if (succeededError) throw succeededError;

        // Process reason breakdown
        const reasonCounts = new Map<CancellationReason, number>();
        for (const row of reasonData || []) {
          if (row.cancellation_reason) {
            const reason = row.cancellation_reason as CancellationReason;
            reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
          }
        }

        // Convert to array and sort by count
        const reasonBreakdown: CancellationReasonData[] = Array.from(reasonCounts.entries())
          .map(([reason, count]) => ({
            reason,
            count,
            label: t(REASON_I18N_KEYS[reason] as keyof typeof REASON_I18N_KEYS),
          }))
          .sort((a, b) => b.count - a.count);

        // Calculate stats
        const totalCanceled = canceledCount ?? 0;
        const totalSucceeded = succeededCount ?? 0;
        const total = totalCanceled + totalSucceeded;
        const cancellationRate = total > 0 ? (totalCanceled / total) * 100 : 0;
        const mostCommonReason = reasonBreakdown.length > 0 ? reasonBreakdown[0].label : null;

        if (!cancelled) {
          setStats({
            totalCanceled,
            totalSucceeded,
            cancellationRate,
            mostCommonReason,
            reasonBreakdown,
          });
        }
      } catch (err) {
        console.error('Error fetching cancellation stats:', err);
        const message = err instanceof Error ? err.message : 'Failed to fetch data';
        if (!cancelled) {
          setError(message);
          toast.error(t('admin.cancellations.fetchError'), { description: message });
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

  // Chart config for ChartContainer
  const chartConfig = useMemo(() => {
    if (!stats) return {};
    const config: Record<string, { label: string; color: string }> = {};
    stats.reasonBreakdown.forEach((item, index) => {
      config[item.reason] = {
        label: item.label,
        color: CHART_COLORS[index % CHART_COLORS.length],
      };
    });
    return config;
  }, [stats]);

  // Bar chart data
  const barChartData = useMemo(() => {
    if (!stats) return [];
    return stats.reasonBreakdown.map((item, index) => ({
      ...item,
      fill: CHART_COLORS[index % CHART_COLORS.length],
    }));
  }, [stats]);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <XCircle className="h-5 w-5 text-rose-500" />
            {t('admin.cancellations.title')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('admin.cancellations.description')}</p>
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {isLoading ? (
          <>
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
          </>
        ) : stats ? (
          <>
            <StatsCard
              title={t('admin.cancellations.totalCanceled')}
              value={formatNumber(stats.totalCanceled)}
              icon={XCircle}
              variant="rose"
            />
            <StatsCard
              title={t('admin.cancellations.cancellationRate')}
              value={`${stats.cancellationRate.toFixed(1)}%`}
              icon={TrendingDown}
              variant="amber"
            />
            <StatsCard
              title={t('admin.cancellations.mostCommonReason')}
              value={stats.mostCommonReason || '-'}
              icon={AlertTriangle}
              variant="violet"
            />
          </>
        ) : null}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Reasons - Bar Chart */}
        <ErrorBoundary
          fallback={
            <ChartCard
              title={t('admin.cancellations.reasonBreakdown')}
              isEmpty
              emptyMessage={t('admin.common.error')}
            />
          }
          language={language}
        >
          <ChartCard
            title={t('admin.cancellations.reasonBreakdown')}
            description={t('admin.cancellations.reasonBreakdownDesc')}
            isLoading={isLoading}
            isEmpty={!stats || stats.reasonBreakdown.length === 0}
            emptyMessage={t('admin.cancellations.noData')}
          >
            <ChartContainer config={chartConfig} className="h-full w-full">
              <BarChart
                data={barChartData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                accessibilityLayer
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" className="text-xs fill-muted-foreground" />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={140}
                  className="text-xs fill-muted-foreground"
                  tick={{ fontSize: 11 }}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent formatter={(value) => formatNumberEN(value as number)} />
                  }
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          </ChartCard>
        </ErrorBoundary>

        {/* Reasons - Pie Chart */}
        <ErrorBoundary
          fallback={
            <ChartCard
              title={t('admin.cancellations.distribution')}
              isEmpty
              emptyMessage={t('admin.common.error')}
            />
          }
          language={language}
        >
          <ChartCard
            title={t('admin.cancellations.distribution')}
            description={t('admin.cancellations.distributionDesc')}
            isLoading={isLoading}
            isEmpty={!stats || stats.reasonBreakdown.length === 0}
            emptyMessage={t('admin.cancellations.noData')}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart accessibilityLayer>
                <Pie
                  data={stats?.reasonBreakdown || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="count"
                  nameKey="label"
                  label={({ name, percent }) =>
                    percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''
                  }
                  labelLine={{ stroke: 'var(--muted-foreground)', strokeWidth: 1 }}
                >
                  {stats?.reasonBreakdown.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                      className="stroke-background"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const data = payload[0].payload as CancellationReasonData;
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-md">
                        <p className="font-medium">{data.label}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatNumberEN(data.count)} {t('admin.cancellations.payments')}
                        </p>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </ErrorBoundary>
      </div>
    </div>
  );
}

export default PaymentCancellationStats;
