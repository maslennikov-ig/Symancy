import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Types
interface UserState {
  telegram_user_id: number;
  onboarding_step: string | null;
  onboarding_data: Record<string, unknown> | null;
  last_analysis_id: string | null;
  updated_at: string | null;
  daily_messages_count: number | null;
  daily_messages_reset_at: string | null;
  profiles: {
    name: string | null;
    first_name: string | null;
    username: string | null;
  } | null;
}

type UserStatus = 'active' | 'in_onboarding' | 'stuck';

const STUCK_THRESHOLD_HOURS = 24;

// Helper: Format relative time
function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return '-';

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
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}w ago`;
  if (diffDay < 365) return `${Math.floor(diffDay / 30)}mo ago`;
  return `${Math.floor(diffDay / 365)}y ago`;
}

// Helper: Calculate user status
function getUserStatus(state: UserState): UserStatus {
  if (!state.onboarding_step) {
    return 'active';
  }

  if (!state.updated_at) {
    return 'stuck';
  }

  const updatedAt = new Date(state.updated_at);
  const now = new Date();
  const diffHours = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60);

  if (diffHours > STUCK_THRESHOLD_HOURS) {
    return 'stuck';
  }

  return 'in_onboarding';
}

// Helper: Get status badge
function StatusBadge({ status }: { status: UserStatus }) {
  switch (status) {
    case 'active':
      return (
        <Badge variant="default" className="bg-green-600">
          Active
        </Badge>
      );
    case 'in_onboarding':
      return (
        <Badge variant="default" className="bg-yellow-500">
          In Onboarding
        </Badge>
      );
    case 'stuck':
      return (
        <Badge variant="destructive">
          Stuck
        </Badge>
      );
  }
}

// Helper: Get display name from profile
function getDisplayName(state: UserState): string {
  if (state.profiles?.name) return state.profiles.name;
  if (state.profiles?.first_name) return state.profiles.first_name;
  if (state.profiles?.username) return `@${state.profiles.username}`;
  return '-';
}

// Loading skeleton component
function UserStatesTableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

export function UserStatesPage() {
  const { user, isAdmin, isLoading: authLoading, signOut } = useAdminAuth();
  const { t } = useAdminTranslations();

  // State
  const [userStates, setUserStates] = useState<UserState[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter
  const [showOnlyStuck, setShowOnlyStuck] = useState(false);

  // Reset dialog state
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserState | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  // Refresh trigger for manual refresh and after reset
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch user states on mount and when dependencies change
  useEffect(() => {
    if (authLoading || !isAdmin) return;

    let cancelled = false;

    async function fetchUserStates() {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: queryError } = await supabase
          .from('user_states')
          .select(`
            telegram_user_id,
            onboarding_step,
            onboarding_data,
            last_analysis_id,
            updated_at,
            daily_messages_count,
            daily_messages_reset_at,
            profiles (
              name,
              first_name,
              username
            )
          `)
          .order('updated_at', { ascending: false, nullsFirst: false });

        if (queryError) {
          throw queryError;
        }

        if (!cancelled) {
          setUserStates((data as unknown as UserState[]) || []);
        }
      } catch (err) {
        console.error('Error fetching user states:', err);
        const message = err instanceof Error ? err.message : 'Failed to fetch user states';
        if (!cancelled) {
          setError(message);
          toast.error('Failed to fetch user states', { description: message });
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchUserStates();

    return () => {
      cancelled = true;
    };
  }, [authLoading, isAdmin, refreshTrigger]);

  // Handle manual refresh
  const handleRefresh = () => setRefreshTrigger((prev) => prev + 1);

  // Handle reset button click
  const handleResetClick = (state: UserState) => {
    setSelectedUser(state);
    setResetDialogOpen(true);
  };

  // Handle reset confirmation
  const handleResetConfirm = async () => {
    if (!selectedUser) return;

    setIsResetting(true);
    try {
      const { error: updateError } = await supabase
        .from('user_states')
        .update({
          onboarding_step: null,
          onboarding_data: {},
          updated_at: new Date().toISOString(),
        })
        .eq('telegram_user_id', selectedUser.telegram_user_id);

      if (updateError) {
        throw updateError;
      }

      // Refresh data
      handleRefresh();
      setResetDialogOpen(false);
      setSelectedUser(null);
      toast.success('User state reset', { description: 'The user can now start fresh.' });
    } catch (err) {
      console.error('Error resetting user state:', err);
      const message = err instanceof Error ? err.message : 'Failed to reset user state';
      setError(message);
      toast.error('Failed to reset user state', { description: message });
    } finally {
      setIsResetting(false);
    }
  };

  // Handle dialog close
  const handleDialogClose = () => {
    if (!isResetting) {
      setResetDialogOpen(false);
      setSelectedUser(null);
    }
  };

  // Filter user states
  const filteredUserStates = showOnlyStuck
    ? userStates.filter((state) => getUserStatus(state) === 'stuck')
    : userStates;

  // Count stuck users
  const stuckCount = userStates.filter((state) => getUserStatus(state) === 'stuck').length;

  // Auth loading state
  if (authLoading) {
    return (
      <AdminLayout title={t('admin.userStates.title')} userName={user?.email} onLogout={signOut}>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">{t('admin.common.loading')}</div>
        </div>
      </AdminLayout>
    );
  }

  // Not admin
  if (!isAdmin) {
    return (
      <AdminLayout title={t('admin.userStates.title')} onLogout={signOut}>
        <div className="flex items-center justify-center h-64">
          <div className="text-destructive">{t('admin.forbidden.message')}</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title={t('admin.userStates.title')}
      userName={user?.user_metadata?.full_name || user?.email}
      userEmail={user?.email}
      onLogout={signOut}
    >
      <div className="space-y-6">
        {/* Header with filter and refresh */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="showOnlyStuck"
                checked={showOnlyStuck}
                onChange={(e) => setShowOnlyStuck(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <Label htmlFor="showOnlyStuck" className="text-sm cursor-pointer">
                {t('admin.userStates.showOnlyStuck')} {stuckCount > 0 && (
                  <span className="text-destructive font-medium">({stuckCount})</span>
                )}
              </Label>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            {t('admin.common.refresh')}
          </Button>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="text-green-500">&#9679;</span>
            <span>{t('admin.userStates.active')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-yellow-500">&#9679;</span>
            <span>{t('admin.userStates.inOnboarding')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-red-500">&#9679;</span>
            <span>{t('admin.userStates.stuck')}</span>
          </div>
        </div>

        {/* Error state with retry button */}
        {error && (
          <div className="flex items-center justify-between gap-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p className="text-red-700 dark:text-red-400">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              {t('admin.common.retry')}
            </Button>
          </div>
        )}

        {/* Table */}
        <div className="rounded-md border bg-card">
          {isLoading ? (
            <UserStatesTableSkeleton />
          ) : filteredUserStates.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              {showOnlyStuck ? t('admin.userStates.noStuck') : t('admin.userStates.noStates')}
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead className="w-[140px]">Telegram ID</TableHead>
                  <TableHead className="w-[160px]">{t('admin.userStates.userName')}</TableHead>
                  <TableHead className="w-[160px]">{t('admin.userStates.onboardingStep')}</TableHead>
                  <TableHead className="w-[120px]">{t('admin.userStates.status')}</TableHead>
                  <TableHead className="w-[120px]">{t('admin.userStates.lastUpdated')}</TableHead>
                  <TableHead className="w-[100px]">{t('admin.userStates.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUserStates.map((state) => {
                  const status = getUserStatus(state);
                  const canReset = status === 'stuck' || status === 'in_onboarding';

                  return (
                    <TableRow
                      key={state.telegram_user_id}
                      className={status === 'stuck' ? 'bg-destructive/5' : undefined}
                    >
                      <TableCell>
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {state.telegram_user_id}
                        </code>
                      </TableCell>
                      <TableCell className="font-medium">
                        {getDisplayName(state)}
                      </TableCell>
                      <TableCell>
                        {state.onboarding_step ? (
                          <Badge
                            variant={status === 'stuck' ? 'destructive' : 'secondary'}
                            className="font-mono text-xs"
                          >
                            {state.onboarding_step}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatRelativeTime(state.updated_at)}
                      </TableCell>
                      <TableCell>
                        {canReset && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResetClick(state)}
                            className="text-destructive hover:text-destructive"
                          >
                            {t('admin.userStates.reset')}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Summary */}
        {!isLoading && userStates.length > 0 && (
          <div className="text-sm text-muted-foreground">
            {t('admin.userStates.showing')} {filteredUserStates.length} {t('admin.userStates.of')} {userStates.length} {t('admin.userStates.userStates')}
            {stuckCount > 0 && (
              <span className="text-destructive ml-2">
                ({stuckCount} {t('admin.userStates.stuck').toLowerCase()})
              </span>
            )}
          </div>
        )}
      </div>

      {/* Reset Confirmation Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.userStates.resetDialogTitle')}</DialogTitle>
            <DialogDescription>
              {t('admin.userStates.resetDialogDescription')}{' '}
              <code className="bg-muted px-1 py-0.5 rounded text-foreground">
                {selectedUser?.telegram_user_id}
              </code>
              {selectedUser && getDisplayName(selectedUser) !== '-' && (
                <> ({getDisplayName(selectedUser)})</>
              )}
              . {t('admin.userStates.resetDialogFresh')}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {selectedUser?.onboarding_step && (
              <div className="text-sm">
                <span className="text-muted-foreground">{t('admin.userStates.currentStep')}:</span>{' '}
                <Badge variant="secondary" className="font-mono">
                  {selectedUser.onboarding_step}
                </Badge>
              </div>
            )}
            {selectedUser?.onboarding_data && Object.keys(selectedUser.onboarding_data).length > 0 && (
              <div className="mt-2 text-sm">
                <span className="text-muted-foreground">{t('admin.userStates.dataWillBeCleared')}:</span>
                <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto max-h-32">
                  {JSON.stringify(selectedUser.onboarding_data, null, 2)}
                </pre>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleDialogClose}
              disabled={isResetting}
            >
              {t('admin.common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleResetConfirm}
              disabled={isResetting}
            >
              {isResetting ? t('admin.userStates.resetting') : t('admin.userStates.reset')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

export default UserStatesPage;
