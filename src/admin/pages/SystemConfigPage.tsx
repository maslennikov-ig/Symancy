import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { AdminLayout } from '../layout/AdminLayout';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { useAdminTranslations } from '../hooks/useAdminTranslations';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

// Types for system_config table
interface SystemConfig {
  key: string;
  value: unknown;
  description: string | null;
  updated_at: string;
}

// Format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

// Truncate JSON for preview
function truncateJson(value: unknown, maxLength: number = 50): string {
  const str = JSON.stringify(value);
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '...';
}

// Format JSON for display in textarea
function formatJsonForEdit(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

// Loading skeleton for table rows
function TableSkeleton() {
  return (
    <>
      {[...Array(5)].map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <Skeleton className="h-5 w-32" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-48" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-40" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-20" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function SystemConfigPage() {
  const { user, signOut } = useAdminAuth();
  const { t } = useAdminTranslations();
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<SystemConfig | null>(null);
  const [editValue, setEditValue] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Refresh trigger for manual refresh and after save
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch configs from Supabase on mount and when refreshTrigger changes
  useEffect(() => {
    let cancelled = false;

    async function fetchConfigs() {
      setLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from('system_config')
          .select('*')
          .order('key');

        if (fetchError) {
          throw fetchError;
        }

        if (!cancelled) {
          setConfigs(data || []);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load configurations';
        if (!cancelled) {
          setError(message);
          toast.error('Failed to load configurations', { description: message });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchConfigs();

    return () => {
      cancelled = true;
    };
  }, [refreshTrigger]);

  // Handle manual refresh
  const handleRefresh = () => setRefreshTrigger((prev) => prev + 1);

  // Open edit dialog
  const handleRowClick = (config: SystemConfig) => {
    setSelectedConfig(config);
    setEditValue(formatJsonForEdit(config.value));
    setJsonError(null);
    setIsDialogOpen(true);
  };

  // Validate JSON on change
  const handleValueChange = (value: string) => {
    setEditValue(value);
    try {
      JSON.parse(value);
      setJsonError(null);
    } catch {
      setJsonError('Invalid JSON format');
    }
  };

  // Save config changes
  const handleSave = async () => {
    if (!selectedConfig || jsonError) return;

    setSaving(true);

    try {
      const parsedValue = JSON.parse(editValue);

      const { error: updateError } = await supabase
        .from('system_config')
        .update({
          value: parsedValue,
          updated_at: new Date().toISOString(),
        })
        .eq('key', selectedConfig.key);

      if (updateError) {
        throw updateError;
      }

      toast.success('Configuration saved', {
        description: `Successfully updated "${selectedConfig.key}"`,
      });

      setIsDialogOpen(false);
      handleRefresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save configuration';
      toast.error('Failed to save', { description: message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout
      title={t('admin.systemConfig.title')}
      userName={user?.user_metadata?.full_name || user?.email || 'Admin'}
      userEmail={user?.email}
      userAvatar={user?.user_metadata?.avatar_url}
      onLogout={signOut}
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{t('admin.systemConfig.settings')}</span>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
              {t('admin.common.refresh')}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && !loading && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center justify-between gap-4">
              <p className="text-red-700 dark:text-red-400">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
              >
                {t('admin.common.retry')}
              </Button>
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">{t('admin.systemConfig.key')}</TableHead>
                <TableHead className="w-[300px]">{t('admin.systemConfig.value')}</TableHead>
                <TableHead>{t('admin.systemConfig.description')}</TableHead>
                <TableHead className="w-[120px] text-right">{t('admin.systemConfig.lastUpdated')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableSkeleton />
              ) : configs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    {t('admin.systemConfig.noConfigs')}
                  </TableCell>
                </TableRow>
              ) : (
                configs.map((config) => (
                  <TableRow
                    key={config.key}
                    onClick={() => handleRowClick(config)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRowClick(config)}
                    tabIndex={0}
                    role="button"
                    aria-label={`Edit configuration ${config.key}`}
                    className="cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
                  >
                    <TableCell>
                      <code className="font-mono font-bold text-sm bg-muted px-1.5 py-0.5 rounded">
                        {config.key}
                      </code>
                    </TableCell>
                    <TableCell>
                      <code className="font-mono text-xs text-muted-foreground">
                        {truncateJson(config.value)}
                      </code>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {config.description || '—'}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                      {formatRelativeTime(config.updated_at)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {t('admin.systemConfig.editConfig')}:{' '}
              <code className="font-mono bg-muted px-2 py-0.5 rounded">
                {selectedConfig?.key}
              </code>
            </DialogTitle>
            <DialogDescription>
              {selectedConfig?.description || t('admin.systemConfig.noDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="config-key">{t('admin.systemConfig.key')}</Label>
              <Input
                id="config-key"
                value={selectedConfig?.key || ''}
                readOnly
                disabled
                className="font-mono bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="config-value">
                {t('admin.systemConfig.value')} (JSON)
                {jsonError && (
                  <span className="ml-2 text-destructive text-xs font-normal">
                    {t('admin.systemConfig.invalidJson')}
                  </span>
                )}
              </Label>
              <textarea
                id="config-value"
                value={editValue}
                onChange={(e) => handleValueChange(e.target.value)}
                className={`
                  flex min-h-[200px] w-full rounded-md border bg-transparent px-3 py-2
                  text-sm font-mono shadow-sm transition-colors
                  placeholder:text-muted-foreground focus-visible:outline-none
                  focus-visible:ring-1 focus-visible:ring-ring
                  disabled:cursor-not-allowed disabled:opacity-50
                  ${jsonError ? 'border-destructive focus-visible:ring-destructive' : 'border-input'}
                `}
                placeholder={t('admin.systemConfig.enterJson')}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saving}>
              {t('admin.common.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={!!jsonError || saving}>
              {saving ? t('admin.common.saving') : t('admin.common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

export default SystemConfigPage;
