// @ts-nocheck - Bypass library type conflicts with React 19
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { supabase } from '@/lib/supabaseClient';
import { AdminLayout } from '../layout/AdminLayout';
import { useAdminAuth } from '../hooks/useAdminAuth';
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
interface UserCredits {
  credits_basic: number;
  credits_pro: number;
  credits_cassandra: number;
}

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

const PAGE_SIZE = 25;

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

// Helper: Format date
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

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

// Credits badges component
function CreditsBadges({ credits }: { credits: UserCredits | null }) {
  if (!credits) {
    return <span className="text-muted-foreground text-sm">-</span>;
  }

  const { credits_basic, credits_pro, credits_cassandra } = credits;
  const hasCredits = credits_basic > 0 || credits_pro > 0 || credits_cassandra > 0;

  if (!hasCredits) {
    return <span className="text-muted-foreground text-sm">0</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {credits_basic > 0 && (
        <Badge variant="secondary" className="text-xs">
          Basic: {credits_basic}
        </Badge>
      )}
      {credits_pro > 0 && (
        <Badge variant="default" className="text-xs bg-blue-600">
          Pro: {credits_pro}
        </Badge>
      )}
      {credits_cassandra > 0 && (
        <Badge variant="default" className="text-xs bg-purple-600">
          Cassandra: {credits_cassandra}
        </Badge>
      )}
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
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch users
  const fetchUsers = useCallback(async () => {
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

      setUsers(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, sortField, sortOrder, debouncedSearch]);

  // Fetch on mount and when dependencies change
  useEffect(() => {
    if (!authLoading && isAdmin) {
      fetchUsers();
    }
  }, [authLoading, isAdmin, fetchUsers]);

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
              onClick={fetchUsers}
              disabled={isLoading}
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md">
            {error}
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
                {users.map((user) => (
                  <TableRow
                    key={user.id}
                    onClick={() => handleRowClick(user.id)}
                    className="cursor-pointer"
                  >
                    <TableCell>
                      {user.telegram_id ? (
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {user.telegram_id}
                        </code>
                      ) : (
                        <Badge variant="outline">Web User</Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {user.display_name || (
                        <span className="text-muted-foreground italic">No name</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <CreditsBadges credits={user.unified_user_credits} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatRelativeTime(user.last_active_at)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(user.created_at)}
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
