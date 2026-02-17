import { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Database,
  Server,
  Wifi,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
} from 'lucide-react';
import { useAdminTranslations } from '../hooks/useAdminTranslations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

// ============================================================================
// Constants
// ============================================================================

const API_BASE_URL = import.meta.env.VITE_API_URL || '';
const REFRESH_INTERVAL_MS = 30_000;

// ============================================================================
// Types
// ============================================================================

interface HealthChecks {
  database: string;
  queue: string;
  webhook: string;
}

interface HealthData {
  status: string;
  version: string;
  uptime: number;
  timestamp: string;
  checks: HealthChecks;
}

interface VersionData {
  version: string;
  buildTime: string;
  gitCommit: string;
  uptime: number;
  startedAt: string;
}

// ============================================================================
// Helpers
// ============================================================================

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function getOverallStatusVariant(status: string): 'default' | 'secondary' | 'destructive' {
  if (status === 'ok') return 'default';
  if (status === 'degraded') return 'secondary';
  return 'destructive';
}

function getOverallStatusClasses(status: string): string {
  if (status === 'ok') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20';
  if (status === 'degraded') return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20';
  return 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/20';
}

function getCheckStatusIcon(status: string) {
  if (status === 'ok') return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (status === 'degraded' || status === 'misconfigured' || status === 'not_set' || status === 'unknown') {
    return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  }
  return <XCircle className="h-4 w-4 text-rose-500" />;
}

function getCheckStatusClasses(status: string): string {
  if (status === 'ok') return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20';
  if (status === 'degraded' || status === 'misconfigured' || status === 'not_set' || status === 'unknown') {
    return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20';
  }
  return 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20';
}

function getCheckIcon(check: string) {
  switch (check) {
    case 'database':
      return <Database className="h-4 w-4 text-muted-foreground" />;
    case 'queue':
      return <Server className="h-4 w-4 text-muted-foreground" />;
    case 'webhook':
      return <Wifi className="h-4 w-4 text-muted-foreground" />;
    default:
      return <Activity className="h-4 w-4 text-muted-foreground" />;
  }
}

function getStatusLabel(status: string, t: (key: string) => string): string {
  if (status === 'ok') return t('admin.monitoring.statusOk');
  if (status === 'degraded') return t('admin.monitoring.statusDegraded');
  if (status === 'error') return t('admin.monitoring.statusError');
  // For other statuses like misconfigured, not_set, unknown - return as-is
  return status;
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function HealthWidgetSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-6 w-36" />
        </div>
        <Skeleton className="h-9 w-9 rounded-md" />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall status skeleton */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
        {/* Checks skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 p-3 rounded-lg border border-border/50">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 w-16" />
              <div className="ml-auto">
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
          ))}
        </div>
        {/* Footer skeleton */}
        <div className="flex items-center gap-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-36 ml-auto" />
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function SystemHealthWidget() {
  const { t } = useAdminTranslations();
  const [health, setHealth] = useState<HealthData | null>(null);
  const [version, setVersion] = useState<VersionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchHealth = useCallback(async (isManual = false) => {
    try {
      if (isManual) {
        setIsRefreshing(true);
      }
      setError(null);

      const [healthRes, versionRes] = await Promise.all([
        fetch(`${API_BASE_URL}/health`),
        fetch(`${API_BASE_URL}/version`),
      ]);

      if (!healthRes.ok) throw new Error(`Health: HTTP ${healthRes.status}`);

      const healthData: HealthData = await healthRes.json();
      setHealth(healthData);

      // Version endpoint is optional - don't fail if it errors
      if (versionRes.ok) {
        const versionData: VersionData = await versionRes.json();
        setVersion(versionData);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch';
      setError(message);
      setHealth(null);
      setVersion(null);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(() => fetchHealth(), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const handleRefresh = () => fetchHealth(true);

  // ---- Loading state ----
  if (loading) {
    return <HealthWidgetSkeleton />;
  }

  // ---- Error state (no data at all) ----
  if (error && !health) {
    return (
      <Card className="border-destructive/30">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Activity className="h-5 w-5 text-rose-500" />
            {t('admin.monitoring.systemHealth')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
            <XCircle className="h-10 w-10 text-rose-400" />
            <p className="text-sm text-muted-foreground">{t('admin.monitoring.fetchError')}</p>
            <p className="text-xs text-muted-foreground/70">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="mt-2 gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {t('admin.common.retry')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ---- Healthy state ----
  if (!health) return null;

  const checks: Array<{ key: string; label: string; status: string }> = [
    { key: 'database', label: t('admin.monitoring.database'), status: health.checks.database },
    { key: 'queue', label: t('admin.monitoring.queue'), status: health.checks.queue },
    { key: 'webhook', label: t('admin.monitoring.webhook'), status: health.checks.webhook },
  ];

  const uptime = version?.uptime ?? health.uptime;
  const displayVersion = version?.version ?? health.version;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5 text-emerald-500" />
          {t('admin.monitoring.systemHealth')}
        </CardTitle>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="h-9 w-9"
          title={t('admin.common.refresh')}
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall status */}
        <div className="flex items-center gap-3">
          <Badge
            variant={getOverallStatusVariant(health.status)}
            className={`text-sm px-3 py-1 ${getOverallStatusClasses(health.status)}`}
          >
            {getCheckStatusIcon(health.status)}
            <span className="ml-1.5">{getStatusLabel(health.status, t)}</span>
          </Badge>

          {/* Show error message inline if we have stale data + error */}
          {error && (
            <span className="text-xs text-amber-600 dark:text-amber-400">
              {t('admin.monitoring.fetchError')}
            </span>
          )}
        </div>

        {/* Individual checks */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {checks.map((check) => (
            <div
              key={check.key}
              className="flex items-center gap-2.5 p-3 rounded-lg border border-border/50 bg-muted/30 dark:bg-muted/10"
            >
              {getCheckIcon(check.key)}
              <span className="text-sm font-medium">{check.label}</span>
              <div className="ml-auto">
                <Badge
                  variant="outline"
                  className={`text-xs gap-1 ${getCheckStatusClasses(check.status)}`}
                >
                  {getCheckStatusIcon(check.status)}
                  {getStatusLabel(check.status, t)}
                </Badge>
              </div>
            </div>
          ))}
        </div>

        {/* Footer info */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {t('admin.monitoring.uptime')}: {formatUptime(uptime)}
          </span>
          <span>
            {t('admin.monitoring.version')}: v{displayVersion}
          </span>
          {version?.gitCommit && (
            <span className="font-mono text-muted-foreground/60">
              {version.gitCommit.slice(0, 7)}
            </span>
          )}
          <span className="ml-auto text-muted-foreground/60">
            {t('admin.monitoring.autoRefresh')}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default SystemHealthWidget;
