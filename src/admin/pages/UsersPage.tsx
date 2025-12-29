import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { AdminLayout } from '../layout/AdminLayout';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { formatRelativeTime, formatDateShort } from '../utils/formatters';
import { PAGE_SIZES, TIME_THRESHOLDS } from '../utils/constants';
import { logger } from '../utils/logger';
import { CreditsBadges, type UserCredits } from '../components/CreditBadge';
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
  display_name: string | null;
  last_active_at: string | null;
  created_at: string;
  unified_user_credits: UserCredits | null;
}

type SortField = 'last_active_at' | 'created_at';
type SortOrder = 'asc' | 'desc';

const PAGE_SIZE = PAGE_SIZES.USERS;

// Loading skeleton component
function UsersTableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 10 }).map((_, i) => (
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
            display_name,
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
          } else {
            query = query.ilike('display_name', `%${term}%`);
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

  // Handle row click
  const handleRowClick = (userId: string) => {
    navigate(`/admin/users/${userId}`);
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
      <AdminLayout title="Users" userName={user?.email} onLogout={signOut}>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </AdminLayout>
    );
  }

  // Not admin
  if (!isAdmin) {
    return (
      <AdminLayout title="Users" onLogout={signOut}>
        <div className="flex items-center justify-center h-64">
          <div className="text-destructive">Access denied. Admin privileges required.</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Users"
      userName={user?.user_metadata?.full_name || user?.email}
      userEmail={user?.email}
      onLogout={signOut}
    >
      <div className="space-y-6">
        {/* Header with search and sort */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex-1 max-w-sm">
            <Input
              placeholder="Search by Telegram ID or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Sort by:</span>
              <Select
                value={`${sortField}-${sortOrder}`}
                onValueChange={handleSortChange}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last_active_at-desc">Last Active (newest)</SelectItem>
                  <SelectItem value="last_active_at-asc">Last Active (oldest)</SelectItem>
                  <SelectItem value="created_at-desc">Created (newest)</SelectItem>
                  <SelectItem value="created_at-asc">Created (oldest)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              Refresh
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
              Retry
            </Button>
          </div>
        )}

        {/* Table */}
        <div className="rounded-md border bg-card">
          {isLoading ? (
            <UsersTableSkeleton />
          ) : users.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              {debouncedSearch ? 'No users found matching your search' : 'No users found'}
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead className="w-[150px]">Telegram ID</TableHead>
                  <TableHead>Display Name</TableHead>
                  <TableHead className="w-[200px]">Credits</TableHead>
                  <TableHead className="w-[120px]">Last Active</TableHead>
                  <TableHead className="w-[120px]">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((userItem) => (
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
                      {userItem.telegram_id ? (
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {userItem.telegram_id}
                        </code>
                      ) : (
                        <Badge variant="outline">Web User</Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {userItem.display_name || (
                        <span className="text-muted-foreground italic">No name</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <CreditsBadges credits={userItem.unified_user_credits} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatRelativeTime(userItem.last_active_at)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateShort(userItem.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Pagination */}
        {totalCount > 0 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {((currentPage - 1) * PAGE_SIZE) + 1} - {Math.min(currentPage * PAGE_SIZE, totalCount)} of {totalCount} users
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => p - 1)}
                disabled={!canGoPrev || isLoading}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground px-2">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => p + 1)}
                disabled={!canGoNext || isLoading}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export default UsersPage;
