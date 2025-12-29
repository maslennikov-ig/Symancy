import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Title,
  Text,
  Metric,
  Flex,
  Grid,
  BarChart,
  AreaChart,
  DonutChart,
  DateRangePicker,
  DateRangePickerValue,
  Badge,
  Table,
  TableHead,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
} from '@tremor/react';
import { DollarSign, Zap, Clock, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { AdminLayout } from '../layout/AdminLayout';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { formatNumberEN, formatCurrencyUSD, formatMs } from '../utils/formatters';

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
  requests: number;
  tokens: number;
  cost: number;
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

// ============================================================================
// Constants
// ============================================================================

// Model pricing per 1M tokens (approximate)
const MODEL_PRICES: Record<string, number> = {
  'google/gemini-1.5-flash': 0.075,
  'google/gemini-2.0-flash': 0.10,
  'google/gemini-2.0-flash-exp:free': 0,
  'openai/gpt-4o-mini': 0.15,
  'anthropic/claude-3.5-sonnet': 3.0,
  'anthropic/claude-3-haiku': 0.25,
  'xiaomi/mimo-v2-flash:free': 0,
};

const MODEL_COLORS: Record<string, string> = {
  'google/gemini-1.5-flash': 'blue',
  'google/gemini-2.0-flash': 'cyan',
  'google/gemini-2.0-flash-exp:free': 'sky',
  'openai/gpt-4o-mini': 'emerald',
  'anthropic/claude-3.5-sonnet': 'violet',
  'anthropic/claude-3-haiku': 'purple',
  'xiaomi/mimo-v2-flash:free': 'orange',
};

const DEFAULT_COLOR = 'slate';

// ============================================================================
// Helpers
// ============================================================================

function estimateCost(tokens: number, model: string): number {
  const price = MODEL_PRICES[model] ?? 0.1; // default $0.10/1M
  return (tokens / 1_000_000) * price;
}

function getDateRange(preset: 'last7' | 'last30' | 'thisMonth'): { from: Date; to: Date } {
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
  // Shorten model names for display
  const parts = model.split('/');
  if (parts.length > 1) {
    return parts[1].replace(':free', ' (free)');
  }
  return model;
}

// ============================================================================
// Loading Skeletons
// ============================================================================

function StatCardSkeleton() {
  return (
    <Card className="animate-pulse" decoration="top" decorationColor="slate">
      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24 mb-3" />
      <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-20" />
    </Card>
  );
}

function ChartSkeleton({ height = 'h-72' }: { height?: string }) {
  return (
    <Card className="animate-pulse">
      <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-32 mb-4" />
      <div className={`${height} bg-slate-100 dark:bg-slate-800 rounded`} />
    </Card>
  );
}

function TableSkeleton() {
  return (
    <Card className="animate-pulse">
      <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-40 mb-4" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-32" />
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-20" />
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24" />
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-16" />
          </div>
        ))}
      </div>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CostsPage() {
  const { user, isAdmin, isLoading: authLoading, signOut } = useAdminAuth();

  // Date range state
  const [dateRange, setDateRange] = useState<DateRangePickerValue>(() => {
    const { from, to } = getDateRange('last30');
    return { from, to };
  });

  // Data state
  const [rawData, setRawData] = useState<LLMCostRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleRetry = () => setRefreshTrigger(prev => prev + 1);

  // Fetch data from Supabase
  useEffect(() => {
    if (authLoading || !isAdmin) return;
    if (!dateRange.from || !dateRange.to) return;

    let cancelled = false;

    async function fetchData() {
      setIsLoading(true);
      setError(null);

      try {
        const fromDate = formatDateForQuery(dateRange.from!);
        const toDate = formatDateForQuery(dateRange.to!);

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

  // Model stats for bar chart and donut chart
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
        ...stats,
      }))
      .sort((a, b) => b.requests - a.requests);
  }, [rawData]);

  // Time series data for area chart
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

    // Convert to array sorted by date
    return Array.from(dateModelMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, modelMap]) => {
        const entry: TimeSeriesData = { date };
        for (const model of allModels) {
          entry[model] = modelMap.get(model) || 0;
        }
        return entry;
      });
  }, [rawData]);

  // Unique model names for chart categories
  const modelNames = useMemo<string[]>(() => {
    return modelStats.map((m) => m.model);
  }, [modelStats]);

  // Model colors for charts
  const chartColors = useMemo<string[]>(() => {
    return modelStats.map((m) => {
      // Find original model key
      const originalKey = Object.keys(MODEL_COLORS).find(
        (k) => formatShortModel(k) === m.model
      );
      return originalKey ? MODEL_COLORS[originalKey] : DEFAULT_COLOR;
    });
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

  // Donut chart data
  const donutData = useMemo(() => {
    return modelStats.map((m) => ({
      name: m.model,
      value: m.requests,
    }));
  }, [modelStats]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleDateRangeChange = (value: DateRangePickerValue) => {
    setDateRange(value);
  };

  const handlePreset = (preset: 'last7' | 'last30' | 'thisMonth') => {
    const { from, to } = getDateRange(preset);
    setDateRange({ from, to });
  };

  // ============================================================================
  // Render
  // ============================================================================

  if (authLoading) {
    return (
      <AdminLayout title="LLM Costs" userName={user?.email} onLogout={signOut}>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </AdminLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AdminLayout title="LLM Costs" onLogout={signOut}>
        <div className="flex items-center justify-center h-64">
          <div className="text-destructive">Access denied. Admin privileges required.</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="LLM Costs"
      userName={user?.user_metadata?.full_name || user?.email}
      userEmail={user?.email}
      onLogout={signOut}
    >
      <div className="space-y-6">
        {/* Date Range Filter */}
        <Card>
          <Flex justifyContent="between" alignItems="center" className="flex-wrap gap-4">
            <div>
              <Title>Cost Analytics</Title>
              <Text>Monitor LLM API usage and estimated costs</Text>
            </div>
            <Flex className="gap-2 flex-wrap">
              <button
                onClick={() => handlePreset('last7')}
                className="px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                Last 7 days
              </button>
              <button
                onClick={() => handlePreset('last30')}
                className="px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                Last 30 days
              </button>
              <button
                onClick={() => handlePreset('thisMonth')}
                className="px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                This month
              </button>
              <DateRangePicker
                value={dateRange}
                onValueChange={handleDateRangeChange}
                enableSelect={false}
                className="max-w-sm"
              />
            </Flex>
          </Flex>
        </Card>

        {/* Error State */}
        {error && (
          <div className="flex items-center justify-between gap-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-700 dark:text-red-400">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              disabled={isLoading}
            >
              Retry
            </Button>
          </div>
        )}

        {/* Summary Stats */}
        {isLoading ? (
          <Grid numItemsMd={2} numItemsLg={4} className="gap-4">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </Grid>
        ) : (
          <Grid numItemsMd={2} numItemsLg={4} className="gap-4">
            <Card decoration="top" decorationColor="blue">
              <Flex justifyContent="between" alignItems="center">
                <div>
                  <Text>Total Requests</Text>
                  <Metric>{formatNumberEN(summaryStats.totalRequests)}</Metric>
                </div>
                <Zap className="h-8 w-8 text-blue-500" />
              </Flex>
            </Card>

            <Card decoration="top" decorationColor="violet">
              <Flex justifyContent="between" alignItems="center">
                <div>
                  <Text>Total Tokens</Text>
                  <Metric>{formatNumberEN(summaryStats.totalTokens)}</Metric>
                </div>
                <Activity className="h-8 w-8 text-violet-500" />
              </Flex>
            </Card>

            <Card decoration="top" decorationColor="emerald">
              <Flex justifyContent="between" alignItems="center">
                <div>
                  <Text>Estimated Cost</Text>
                  <Metric>{formatCurrencyUSD(summaryStats.estimatedCost)}</Metric>
                </div>
                <DollarSign className="h-8 w-8 text-emerald-500" />
              </Flex>
            </Card>

            <Card decoration="top" decorationColor="amber">
              <Flex justifyContent="between" alignItems="center">
                <div>
                  <Text>Avg Processing Time</Text>
                  <Metric>{formatMs(summaryStats.avgProcessingMs)}</Metric>
                </div>
                <Clock className="h-8 w-8 text-amber-500" />
              </Flex>
            </Card>
          </Grid>
        )}

        {/* Charts Row */}
        <Grid numItemsMd={2} className="gap-6">
          {/* Requests by Model - Bar Chart */}
          {isLoading ? (
            <ChartSkeleton />
          ) : (
            <Card>
              <Title>Requests by Model</Title>
              <Text>Number of API requests per model</Text>
              {modelStats.length === 0 ? (
                <div className="h-72 flex items-center justify-center text-slate-500">
                  No data available
                </div>
              ) : (
                <BarChart
                  className="mt-4 h-72"
                  data={modelStats}
                  index="model"
                  categories={['requests']}
                  colors={['blue']}
                  valueFormatter={(v) => formatNumberEN(v)}
                  showLegend={false}
                />
              )}
            </Card>
          )}

          {/* Model Distribution - Donut Chart */}
          {isLoading ? (
            <ChartSkeleton />
          ) : (
            <Card>
              <Title>Model Distribution</Title>
              <Text>Percentage of requests by model</Text>
              {donutData.length === 0 ? (
                <div className="h-72 flex items-center justify-center text-slate-500">
                  No data available
                </div>
              ) : (
                <DonutChart
                  className="mt-4 h-72"
                  data={donutData}
                  category="value"
                  index="name"
                  valueFormatter={(v) => `${formatNumberEN(v)} requests`}
                  colors={chartColors}
                  showLabel
                  showAnimation
                />
              )}
            </Card>
          )}
        </Grid>

        {/* Tokens Over Time - Area Chart */}
        {isLoading ? (
          <ChartSkeleton height="h-80" />
        ) : (
          <Card>
            <Title>Tokens Over Time</Title>
            <Text>Daily token usage stacked by model</Text>
            {timeSeriesData.length === 0 ? (
              <div className="h-80 flex items-center justify-center text-slate-500">
                No data available
              </div>
            ) : (
              <AreaChart
                className="mt-4 h-80"
                data={timeSeriesData}
                index="date"
                categories={modelNames}
                colors={chartColors}
                valueFormatter={(v) => formatNumberEN(v)}
                showLegend
                stack
              />
            )}
          </Card>
        )}

        {/* Per-User Breakdown Table */}
        {isLoading ? (
          <TableSkeleton />
        ) : (
          <Card>
            <Title>Per-User Breakdown</Title>
            <Text>Top 20 users by token usage</Text>
            {userStats.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-slate-500">
                No data available
              </div>
            ) : (
              <Table className="mt-4">
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>User</TableHeaderCell>
                    <TableHeaderCell className="text-right">Requests</TableHeaderCell>
                    <TableHeaderCell className="text-right">Tokens</TableHeaderCell>
                    <TableHeaderCell className="text-right">Est. Cost</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {userStats.map((user) => (
                    <TableRow key={user.userId}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{user.displayName}</span>
                          {user.telegramId && (
                            <Badge color="slate" size="xs">
                              TG: {user.telegramId}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{formatNumberEN(user.requests)}</TableCell>
                      <TableCell className="text-right">{formatNumberEN(user.tokens)}</TableCell>
                      <TableCell className="text-right">{formatCurrencyUSD(user.cost)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}

export default CostsPage;
