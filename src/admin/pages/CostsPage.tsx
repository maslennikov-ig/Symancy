import React, { useState, useEffect, useMemo } from 'react';
import { DollarSign, Zap, Clock, Activity, Download, Calendar, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { AdminLayout } from '../layout/AdminLayout';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { useAdminTranslations } from '../hooks/useAdminTranslations';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { StatsCard, StatsCardSkeleton } from '../components/StatsCard';
import { ChartCard } from '../components/ChartCard';
import { formatNumberEN, formatCurrencyUSD, formatMs } from '../utils/formatters';
import { exportToCsv } from '../utils/exportCsv';
import { cn } from '@/lib/utils';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import type { Lang } from '@/lib/i18n';

// HIGH-2: Locale mapping for i18n date formatting
const LOCALE_MAP: Record<Lang, string> = {
  en: 'en-US',
  ru: 'ru-RU',
  zh: 'zh-CN',
};

// ============================================================================
// Types
// ============================================================================

interface LLMCostRow {
  unified_user_id: string;
  display_name: string | null;
  telegram_id: number | null;
  model_used: string;
  date: string;
  request_count: number;
  total_tokens: number;
  avg_processing_ms: number;
}

interface SummaryStats {
  totalRequests: number;
  totalTokens: number;
  estimatedCost: number;
  avgProcessingMs: number;
}

interface ModelStats {
  model: string;
  fullModel: string;
  requests: number;
  tokens: number;
  cost: number;
  [key: string]: string | number; // Index signature for Recharts compatibility
}

interface TimeSeriesData {
  date: string;
  [model: string]: string | number;
}

interface UserStats {
  userId: string;
  displayName: string;
  telegramId: number | null;
  requests: number;
  tokens: number;
  cost: number;
}

type DatePreset = 'last7' | 'last30' | 'thisMonth';

// ============================================================================
// Constants
// ============================================================================

// Model pricing per 1M tokens (approximate)
const MODEL_PRICES: Record<string, number> = {
  'google/gemini-1.5-flash': 0.075,
  'google/gemini-2.0-flash': 0.1,
  'google/gemini-2.0-flash-exp:free': 0,
  'openai/gpt-4o-mini': 0.15,
  'anthropic/claude-3.5-sonnet': 3.0,
  'anthropic/claude-3-haiku': 0.25,
  'xiaomi/mimo-v2-flash:free': 0,
};

// Chart colors for different models (using CSS variables)
const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

// ============================================================================
// Helpers
// ============================================================================

function estimateCost(tokens: number, model: string): number {
  const price = MODEL_PRICES[model] ?? 0.1; // default $0.10/1M
  return (tokens / 1_000_000) * price;
}

function getDateRange(preset: DatePreset): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);

  let from: Date;
  switch (preset) {
    case 'last7':
      from = new Date(now);
      from.setDate(from.getDate() - 6);
      from.setHours(0, 0, 0, 0);
      break;
    case 'last30':
      from = new Date(now);
      from.setDate(from.getDate() - 29);
      from.setHours(0, 0, 0, 0);
      break;
    case 'thisMonth':
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      from.setHours(0, 0, 0, 0);
      break;
  }
  return { from, to };
}

function formatDateForQuery(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatShortModel(model: string): string {
  const parts = model.split('/');
  if (parts.length > 1) {
    return parts[1].replace(':free', ' (free)');
  }
  return model;
}

// HIGH-2: Accept locale parameter for i18n support
function formatChartDate(dateStr: string, locale: string = 'en-US'): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

// ============================================================================
// Main Component
// ============================================================================

export function CostsPage() {
  const { user, isAdmin, isLoading: authLoading, signOut } = useAdminAuth();
  const { t, language } = useAdminTranslations();

  // HIGH-2: Get locale for date formatting
  const dateLocale = LOCALE_MAP[language];

  // Date range state
  const [datePreset, setDatePreset] = useState<DatePreset>('last30');
  const [dateRange, setDateRange] = useState(() => getDateRange('last30'));

  // Data state
  const [rawData, setRawData] = useState<LLMCostRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleRetry = () => setRefreshTrigger((prev) => prev + 1);

  const handlePreset = (preset: DatePreset) => {
    setDatePreset(preset);
    setDateRange(getDateRange(preset));
  };

  // Fetch data from Supabase
  useEffect(() => {
    if (authLoading || !isAdmin) return;
    if (!dateRange.from || !dateRange.to) return;

    let cancelled = false;

    async function fetchData() {
      setIsLoading(true);
      setError(null);

      try {
        const fromDate = formatDateForQuery(dateRange.from);
        const toDate = formatDateForQuery(dateRange.to);

        const { data, error: queryError } = await supabase
          .from('admin_llm_costs')
          .select('*')
          .gte('date', fromDate)
          .lte('date', toDate)
          .order('date', { ascending: true });

        if (queryError) throw queryError;

        if (!cancelled) {
          setRawData(data || []);
        }
      } catch (err) {
        console.error('Error fetching LLM costs:', err);
        const message = err instanceof Error ? err.message : 'Failed to fetch data';
        if (!cancelled) {
          setError(message);
          toast.error('Failed to fetch LLM costs', { description: message });
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
  }, [authLoading, isAdmin, dateRange.from, dateRange.to, refreshTrigger]);

  // ============================================================================
  // Computed Data
  // ============================================================================

  // Summary stats
  const summaryStats = useMemo<SummaryStats>(() => {
    if (rawData.length === 0) {
      return { totalRequests: 0, totalTokens: 0, estimatedCost: 0, avgProcessingMs: 0 };
    }

    let totalRequests = 0;
    let totalTokens = 0;
    let totalCost = 0;
    let weightedProcessingSum = 0;

    for (const row of rawData) {
      totalRequests += row.request_count;
      totalTokens += row.total_tokens;
      totalCost += estimateCost(row.total_tokens, row.model_used);
      weightedProcessingSum += row.avg_processing_ms * row.request_count;
    }

    const avgProcessingMs = totalRequests > 0 ? weightedProcessingSum / totalRequests : 0;

    return { totalRequests, totalTokens, estimatedCost: totalCost, avgProcessingMs };
  }, [rawData]);

  // Model stats for bar chart and pie chart
  const modelStats = useMemo<ModelStats[]>(() => {
    const modelMap = new Map<string, { requests: number; tokens: number; cost: number }>();

    for (const row of rawData) {
      const existing = modelMap.get(row.model_used) || { requests: 0, tokens: 0, cost: 0 };
      existing.requests += row.request_count;
      existing.tokens += row.total_tokens;
      existing.cost += estimateCost(row.total_tokens, row.model_used);
      modelMap.set(row.model_used, existing);
    }

    return Array.from(modelMap.entries())
      .map(([model, stats]) => ({
        model: formatShortModel(model),
        fullModel: model,
        ...stats,
      }))
      .sort((a, b) => b.requests - a.requests);
  }, [rawData]);

  // Time series data for area chart
  // HIGH-2: Use dateLocale for i18n date formatting
  const timeSeriesData = useMemo<TimeSeriesData[]>(() => {
    const dateModelMap = new Map<string, Map<string, number>>();
    const allModels = new Set<string>();

    for (const row of rawData) {
      const dateKey = row.date.split('T')[0];
      const shortModel = formatShortModel(row.model_used);
      allModels.add(shortModel);

      if (!dateModelMap.has(dateKey)) {
        dateModelMap.set(dateKey, new Map());
      }
      const modelMap = dateModelMap.get(dateKey)!;
      modelMap.set(shortModel, (modelMap.get(shortModel) || 0) + row.total_tokens);
    }

    return Array.from(dateModelMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, modelMap]) => {
        const entry: TimeSeriesData = { date: formatChartDate(date, dateLocale) };
        for (const model of allModels) {
          entry[model] = modelMap.get(model) || 0;
        }
        return entry;
      });
  }, [rawData, dateLocale]);

  // Unique model names for chart categories
  const modelNames = useMemo<string[]>(() => {
    return modelStats.map((m) => m.model);
  }, [modelStats]);

  // User breakdown stats
  const userStats = useMemo<UserStats[]>(() => {
    const userMap = new Map<
      string,
      { displayName: string; telegramId: number | null; requests: number; tokens: number; cost: number }
    >();

    for (const row of rawData) {
      const existing = userMap.get(row.unified_user_id) || {
        displayName: row.display_name || 'Unknown',
        telegramId: row.telegram_id,
        requests: 0,
        tokens: 0,
        cost: 0,
      };
      existing.requests += row.request_count;
      existing.tokens += row.total_tokens;
      existing.cost += estimateCost(row.total_tokens, row.model_used);
      userMap.set(row.unified_user_id, existing);
    }

    return Array.from(userMap.entries())
      .map(([userId, stats]) => ({
        userId,
        ...stats,
      }))
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, 20);
  }, [rawData]);

  // Chart config for ChartContainer
  const chartConfig = useMemo(() => {
    const config: Record<string, { label: string; color: string }> = {};
    modelNames.forEach((name, index) => {
      config[name] = {
        label: name,
        color: CHART_COLORS[index % CHART_COLORS.length],
      };
    });
    return config;
  }, [modelNames]);

  // Handle CSV export
  const handleExport = () => {
    exportToCsv(userStats, 'admin-llm-costs', [
      { header: 'Display Name', accessor: 'displayName' },
      { header: 'Telegram ID', accessor: 'telegramId' },
      { header: 'Requests', accessor: 'requests' },
      { header: 'Tokens', accessor: 'tokens' },
      { header: 'Estimated Cost (USD)', accessor: (item) => item.cost.toFixed(4) },
    ]);
    toast.success(t('admin.common.exported'));
  };

  // ============================================================================
  // Render
  // ============================================================================

  if (authLoading) {
    return (
      <AdminLayout title={t('admin.costs.title')} userName={user?.email} onLogout={signOut}>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">{t('admin.common.loading')}</div>
        </div>
      </AdminLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AdminLayout title={t('admin.costs.title')} onLogout={signOut}>
        <div className="flex items-center justify-center h-64">
          <div className="text-destructive">{t('admin.forbidden.message')}</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title={t('admin.costs.title')}
      userName={user?.user_metadata?.full_name || user?.email}
      userEmail={user?.email}
      onLogout={signOut}
    >
      <div className="space-y-6">
        {/* Header with Date Filter */}
        <Card className="border-none bg-gradient-to-r from-card via-card to-muted/30">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-2xl font-bold flex items-center gap-2">
                  <TrendingUp className="h-6 w-6 text-primary" />
                  {t('admin.costs.analytics')}
                </CardTitle>
                <CardDescription>{t('admin.costs.monitorUsage')}</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* Date Preset Buttons */}
                {/* MEDIUM-4: ARIA labels for date preset buttons */}
                <div className="inline-flex items-center rounded-lg border bg-card p-1" role="group" aria-label={t('admin.costs.dateRange')}>
                  <button
                    onClick={() => handlePreset('last7')}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all',
                      datePreset === 'last7'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    )}
                    aria-pressed={datePreset === 'last7'}
                    aria-label={t('admin.costs.last7')}
                  >
                    <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('admin.costs.last7')}
                  </button>
                  <button
                    onClick={() => handlePreset('last30')}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all',
                      datePreset === 'last30'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    )}
                    aria-pressed={datePreset === 'last30'}
                    aria-label={t('admin.costs.last30')}
                  >
                    {t('admin.costs.last30')}
                  </button>
                  <button
                    onClick={() => handlePreset('thisMonth')}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all',
                      datePreset === 'thisMonth'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    )}
                    aria-pressed={datePreset === 'thisMonth'}
                    aria-label={t('admin.costs.thisMonth')}
                  >
                    {t('admin.costs.thisMonth')}
                  </button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  disabled={userStats.length === 0 || isLoading}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  {t('admin.common.export')}
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

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

        {/* Summary Stats */}
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
                title={t('admin.costs.totalRequests')}
                value={formatNumberEN(summaryStats.totalRequests)}
                icon={Zap}
                variant="blue"
              />
              <StatsCard
                title={t('admin.costs.totalTokens')}
                value={formatNumberEN(summaryStats.totalTokens)}
                icon={Activity}
                variant="violet"
              />
              <StatsCard
                title={t('admin.costs.estimatedCost')}
                value={formatCurrencyUSD(summaryStats.estimatedCost)}
                icon={DollarSign}
                variant="emerald"
              />
              <StatsCard
                title={t('admin.costs.avgProcessingTime')}
                value={formatMs(summaryStats.avgProcessingMs)}
                icon={Clock}
                variant="amber"
              />
            </>
          )}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Requests by Model - Bar Chart */}
          {/* HIGH-4: ErrorBoundary for chart rendering */}
          <ErrorBoundary
            fallback={<ChartCard title={t('admin.costs.requestsByModel')} isEmpty emptyMessage={t('admin.common.error')} />}
            language={language}
          >
            <ChartCard
              title={t('admin.costs.requestsByModel')}
              description={t('admin.costs.requestsPerModel')}
              isLoading={isLoading}
              isEmpty={modelStats.length === 0}
              emptyMessage={t('admin.costs.noData')}
            >
              <ChartContainer config={chartConfig} className="h-full w-full">
                {/* HIGH-1: accessibilityLayer for keyboard navigation */}
                <BarChart
                  data={modelStats}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  accessibilityLayer
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" className="text-xs fill-muted-foreground" />
                  <YAxis
                    type="category"
                    dataKey="model"
                    width={120}
                    className="text-xs fill-muted-foreground"
                    tick={{ fontSize: 11 }}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => formatNumberEN(value as number)}
                      />
                    }
                  />
                  <Bar dataKey="requests" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            </ChartCard>
          </ErrorBoundary>

          {/* Model Distribution - Pie Chart */}
          <ErrorBoundary
            fallback={<ChartCard title={t('admin.costs.modelDistribution')} isEmpty emptyMessage={t('admin.common.error')} />}
            language={language}
          >
            <ChartCard
              title={t('admin.costs.modelDistribution')}
              description={t('admin.costs.percentageByModel')}
              isLoading={isLoading}
              isEmpty={modelStats.length === 0}
              emptyMessage={t('admin.costs.noData')}
            >
              <ResponsiveContainer width="100%" height="100%">
                {/* HIGH-1: accessibilityLayer for keyboard navigation */}
                <PieChart accessibilityLayer>
                  <Pie
                    data={modelStats}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="requests"
                    nameKey="model"
                    // HIGH-5: Only show label for slices > 5% to prevent overlap
                    label={({ name, percent }) =>
                      percent > 0.05 ? `${name} (${(percent * 100).toFixed(0)}%)` : ''
                    }
                    labelLine={{ stroke: 'var(--muted-foreground)', strokeWidth: 1 }}
                  >
                    {modelStats.map((_, index) => (
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
                      const data = payload[0].payload as ModelStats;
                      return (
                        <div className="rounded-lg border bg-background p-2 shadow-md">
                          <p className="font-medium">{data.model}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatNumberEN(data.requests)} requests
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

        {/* Tokens Over Time - Area Chart */}
        <ErrorBoundary
          fallback={<ChartCard title={t('admin.costs.tokensOverTime')} isEmpty emptyMessage={t('admin.common.error')} height="h-80" />}
          language={language}
        >
          <ChartCard
            title={t('admin.costs.tokensOverTime')}
            description={t('admin.costs.dailyTokenUsage')}
            isLoading={isLoading}
            isEmpty={timeSeriesData.length === 0}
            emptyMessage={t('admin.costs.noData')}
            height="h-80"
          >
            <ChartContainer config={chartConfig} className="h-full w-full">
              {/* HIGH-1: accessibilityLayer for keyboard navigation */}
              <AreaChart
                data={timeSeriesData}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                accessibilityLayer
              >
                <defs>
                  {modelNames.map((name, index) => (
                    <linearGradient key={name} id={`gradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor={CHART_COLORS[index % CHART_COLORS.length]}
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor={CHART_COLORS[index % CHART_COLORS.length]}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs fill-muted-foreground" />
                <YAxis className="text-xs fill-muted-foreground" />
                <ChartTooltip
                  content={
                    <ChartTooltipContent formatter={(value) => formatNumberEN(value as number)} />
                  }
                />
                <Legend />
                {modelNames.map((name, index) => (
                  <Area
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stackId="1"
                    stroke={CHART_COLORS[index % CHART_COLORS.length]}
                    fill={`url(#gradient-${index})`}
                    strokeWidth={2}
                  />
                ))}
              </AreaChart>
            </ChartContainer>
          </ChartCard>
        </ErrorBoundary>

        {/* Per-User Breakdown Table */}
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.costs.perUserBreakdown')}</CardTitle>
            <CardDescription>{t('admin.costs.top20Users')}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex gap-4 animate-pulse">
                    <div className="h-4 bg-muted rounded w-32" />
                    <div className="h-4 bg-muted rounded w-20" />
                    <div className="h-4 bg-muted rounded w-24" />
                    <div className="h-4 bg-muted rounded w-16" />
                  </div>
                ))}
              </div>
            ) : userStats.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-muted-foreground rounded-lg bg-muted/30 border border-dashed border-border">
                {t('admin.costs.noData')}
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                {/* MEDIUM-7: Improved table accessibility with keyboard navigation */}
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>{t('admin.costs.user')}</TableHead>
                      <TableHead className="text-right">{t('admin.costs.requests')}</TableHead>
                      <TableHead className="text-right">{t('admin.costs.tokens')}</TableHead>
                      <TableHead className="text-right">{t('admin.costs.estCost')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userStats.map((user, index) => (
                      <TableRow
                        key={user.userId}
                        tabIndex={0}
                        className={cn(
                          'transition-colors hover:bg-muted/50 focus:outline-none focus:bg-muted/70 focus:ring-2 focus:ring-primary focus:ring-inset',
                          index === 0 && 'bg-primary/5'
                        )}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{user.displayName}</span>
                            {user.telegramId && (
                              <Badge variant="secondary" className="text-xs">
                                TG: {user.telegramId}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatNumberEN(user.requests)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatNumberEN(user.tokens)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-emerald-600 dark:text-emerald-400">
                          {formatCurrencyUSD(user.cost)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

export default CostsPage;
