import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { AdminLayout } from '../layout/AdminLayout';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { useAdminTranslations } from '../hooks/useAdminTranslations';
import { formatRelativeTime, formatDateShort } from '../utils/formatters';
import { sanitizeDisplayName } from '../utils/sanitize';
import { PAGE_SIZES, TIME_THRESHOLDS } from '../utils/constants';
import { logger } from '../utils/logger';
import { exportToCsv } from '../utils/exportCsv';
import { CreditsBadges, type UserCredits } from '../components/CreditBadge';
import { UserActionsMenu } from '../components/UserActionsMenu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Types
interface UnifiedUser {
  id: string;
  telegram_id: string | null;
  auth_id: string | null;
  display_name: string | null;
  email: string | null;
  is_banned: boolean;
  last_active_at: string | null;
  created_at: string;
  unified_user_credits: UserCredits | null;
}

// Helper to determine user type
function getUserType(user: UnifiedUser): 'linked' | 'telegram' | 'web' {
  if (user.telegram_id && user.auth_id) return 'linked';
  if (user.telegram_id) return 'telegram';
  return 'web';
}

type SortField = 'last_active_at' | 'created_at';
type SortOrder = 'asc' | 'desc';

const PAGE_SIZE = PAGE_SIZES.USERS;

// Loading skeleton component
function UsersTableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: PAGE_SIZE }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}

export function UsersPage() {
  const navigate = useNavigate();
  const { user, isAdmin, isLoading: authLoading, signOut } = useAdminAuth();
  const { t } = useAdminTranslations();

  // State
  const [users, setUsers] = useState<UnifiedUser[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('last_active_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1); // Reset to first page on search
    }, TIME_THRESHOLDS.SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Refresh trigger for manual refresh button
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch users on mount and when dependencies change
  useEffect(() => {
    if (authLoading || !isAdmin) return;

    let cancelled = false;

    async function fetchUsers() {
      setIsLoading(true);
      setError(null);

      try {
        const offset = (currentPage - 1) * PAGE_SIZE;

        let query = supabase
          .from('unified_users')
          .select(`
            id,
            telegram_id,
            auth_id,
            display_name,
            email,
            is_banned,
            last_active_at,
            created_at,
            unified_user_credits (
              credits_basic,
              credits_pro,
              credits_cassandra
            )
          `, { count: 'exact' })
          .order(sortField, { ascending: sortOrder === 'asc' })
          .range(offset, offset + PAGE_SIZE - 1);

        // Apply search filter
        if (debouncedSearch.trim()) {
          const term = debouncedSearch.trim();
          // Check if search term is numeric (telegram_id search)
          if (/^\d+$/.test(term)) {
            query = query.eq('telegram_id', term);
          } else if (term.includes('@')) {
            // Search by email
            query = query.ilike('email', `%${term}%`);
          } else {
            // Search by display_name or email
            query = query.or(`display_name.ilike.%${term}%,email.ilike.%${term}%`);
          }
        }

        const { data, count, error: queryError } = await query;

        if (queryError) {
          throw queryError;
        }

        if (!cancelled) {
          setUsers((data as unknown as UnifiedUser[]) || []);
          setTotalCount(count || 0);
        }
      } catch (err) {
        logger.error('Error fetching users', err);
        const message = err instanceof Error ? err.message : 'Failed to fetch users';
        if (!cancelled) {
          setError(message);
          toast.error('Failed to fetch users', { description: message });
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchUsers();

    return () => {
      cancelled = true;
    };
  }, [authLoading, isAdmin, currentPage, sortField, sortOrder, debouncedSearch, refreshTrigger]);

  // Handle manual refresh
  const handleRefresh = () => setRefreshTrigger((prev) => prev + 1);

  // Handle CSV export
  const handleExport = () => {
    exportToCsv(users, 'admin-users', [
      { header: 'Telegram ID', accessor: 'telegram_id' },
      { header: 'Display Name', accessor: 'display_name' },
      {
        header: 'Basic Credits',
        accessor: (item) => item.unified_user_credits?.credits_basic ?? 0,
      },
      {
        header: 'Pro Credits',
        accessor: (item) => item.unified_user_credits?.credits_pro ?? 0,
      },
      {
        header: 'Cassandra Credits',
        accessor: (item) => item.unified_user_credits?.credits_cassandra ?? 0,
      },
      {
        header: 'Status',
        accessor: (item) => item.is_banned ? 'Banned' : 'Active',
      },
      { header: 'Last Active', accessor: 'last_active_at' },
      { header: 'Created At', accessor: 'created_at' },
    ]);
    toast.success(t('admin.common.exported'));
  };

  // Handle row click
  const handleRowClick = (userId: string) => {
    navigate(`/admin/users/${userId}`);
  };

  // Handle ban/unban toggle
  const handleToggleBan = async (userId: string, shouldBan: boolean) => {
    const { error } = await supabase.rpc('admin_toggle_ban', {
      p_user_id: userId,
      p_is_banned: shouldBan,
      p_reason: null,
    });
    if (error) {
      logger.error('Error toggling ban', error);
      toast.error(t('admin.users.actionFailed'));
      return;
    }
    toast.success(
      shouldBan ? t('admin.users.banSuccess') : t('admin.users.unbanSuccess')
    );
    setRefreshTrigger((prev) => prev + 1);
  };

  // Handle delete user
  const handleDeleteUser = async (userId: string) => {
    const { error } = await supabase.rpc('admin_delete_user', {
      p_user_id: userId,
      p_reason: null,
    });
    if (error) {
      logger.error('Error deleting user', error);
      toast.error(t('admin.users.actionFailed'));
      return;
    }
    toast.success(t('admin.users.deleteSuccess'));
    setRefreshTrigger((prev) => prev + 1);
  };

  // Handle admin toggle (grant/revoke)
  const handleAdminToggle = async (userId: string, email: string, shouldGrant: boolean) => {
    const rpcName = shouldGrant ? 'admin_add_admin_email' : 'admin_remove_admin_email';
    const { error } = await supabase.rpc(rpcName, {
      p_email: email,
    });
    if (error) {
      logger.error('Error toggling admin', error);
      toast.error(t('admin.users.actionFailed'));
      return;
    }
    toast.success(
      shouldGrant ? t('admin.users.grantAdminSuccess') : t('admin.users.revokeAdminSuccess')
    );
    setRefreshTrigger((prev) => prev + 1);
  };

  // Handle sort change
  const handleSortChange = (value: string) => {
    const [field, order] = value.split('-') as [SortField, SortOrder];
    setSortField(field);
    setSortOrder(order);
    setCurrentPage(1);
  };

  // Pagination helpers
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  // Auth loading state
  if (authLoading) {
    return (
      <AdminLayout title={t('admin.users.title')} userName={user?.email} onLogout={signOut}>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">{t('admin.common.loading')}</div>
        </div>
      </AdminLayout>
    );
  }

  // Not admin
  if (!isAdmin) {
    return (
      <AdminLayout title={t('admin.users.title')} onLogout={signOut}>
        <div className="flex items-center justify-center h-64">
          <div className="text-destructive">{t('admin.forbidden.message')}</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title={t('admin.users.title')}
      userName={user?.user_metadata?.full_name || user?.email}
      userEmail={user?.email}
      onLogout={signOut}
    >
      <div className="space-y-6">
        {/* Header with search and sort */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex-1 max-w-sm">
            <Input
              placeholder={t('admin.users.search')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{t('admin.users.sortBy')}:</span>
              <Select
                value={`${sortField}-${sortOrder}`}
                onValueChange={handleSortChange}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last_active_at-desc">{t('admin.users.lastActive')} (newest)</SelectItem>
                  <SelectItem value="last_active_at-asc">{t('admin.users.lastActive')} (oldest)</SelectItem>
                  <SelectItem value="created_at-desc">{t('admin.users.createdAt')} (newest)</SelectItem>
                  <SelectItem value="created_at-asc">{t('admin.users.createdAt')} (oldest)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={users.length === 0 || isLoading}
            >
              <Download className="h-4 w-4 mr-2" />
              {t('admin.common.export')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              {t('admin.common.refresh')}
            </Button>
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
            <UsersTableSkeleton />
          ) : users.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              {t('admin.users.noUsers')}
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead className="w-[120px]">ID / Type</TableHead>
                  <TableHead>{t('admin.users.columns.displayName')}</TableHead>
                  <TableHead className="w-[200px]">Email</TableHead>
                  <TableHead className="w-[180px]">{t('admin.users.columns.credits')}</TableHead>
                  <TableHead className="w-[80px]">{t('admin.users.columns.status')}</TableHead>
                  <TableHead className="w-[100px]">{t('admin.users.columns.lastActive')}</TableHead>
                  <TableHead className="w-[80px]">{t('admin.users.columns.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((userItem) => {
                  const userType = getUserType(userItem);
                  return (
                  <TableRow
                    key={userItem.id}
                    onClick={() => handleRowClick(userItem.id)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRowClick(userItem.id)}
                    tabIndex={0}
                    role="button"
                    aria-label={`View details for ${userItem.display_name || userItem.telegram_id || 'user'}`}
                    className="cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
                  >
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {userItem.telegram_id && (
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                            {userItem.telegram_id}
                          </code>
                        )}
                        <Badge
                          variant={userType === 'linked' ? 'default' : 'outline'}
                          className="w-fit text-xs"
                        >
                          {userType === 'linked' ? '🔗 Linked' : userType === 'telegram' ? '📱 TG' : '🌐 Web'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {sanitizeDisplayName(userItem.display_name) === 'No name' ? (
                        <span className="text-muted-foreground italic">No name</span>
                      ) : (
                        sanitizeDisplayName(userItem.display_name)
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {userItem.email ? (
                        <span className="text-muted-foreground">{userItem.email}</span>
                      ) : (
                        <span className="text-muted-foreground/50 italic">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <CreditsBadges credits={userItem.unified_user_credits} />
                    </TableCell>
                    <TableCell>
                      <Badge variant={userItem.is_banned ? 'destructive' : 'default'}>
                        {userItem.is_banned
                          ? t('admin.users.status.banned')
                          : t('admin.users.status.active')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatRelativeTime(userItem.last_active_at)}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <UserActionsMenu
                        userId={userItem.id}
                        displayName={userItem.display_name}
                        email={userItem.email}
                        isBanned={userItem.is_banned}
                        onViewDetails={() => handleRowClick(userItem.id)}
                        onBanToggle={handleToggleBan}
                        onDelete={handleDeleteUser}
                        onAdminToggle={handleAdminToggle}
                      />
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Pagination */}
        {totalCount > 0 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {t('admin.users.total')}: {totalCount}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => p - 1)}
                disabled={!canGoPrev || isLoading}
              >
                {t('admin.common.back')}
              </Button>
              <span className="text-sm text-muted-foreground px-2">
                {t('admin.users.page')} {currentPage} {t('admin.users.of')} {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => p + 1)}
                disabled={!canGoNext || isLoading}
              >
                {t('admin.common.next')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export default UsersPage;
