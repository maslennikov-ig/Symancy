// @ts-nocheck - Bypass library type conflicts with React 19
import React, { useState, useEffect, useCallback } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Types
interface UnifiedUser {
  display_name: string | null;
  telegram_id: string | null;
}

interface Conversation {
  unified_user_id: string;
  unified_users: UnifiedUser | null;
}

interface Message {
  id: string;
  conversation_id: string;
  channel: 'telegram' | 'web';
  interface: string | null;
  role: 'user' | 'assistant' | 'system';
  content: string;
  content_type: 'text' | 'image' | 'analysis' | 'audio' | 'document';
  metadata: Record<string, unknown> | null;
  processing_status: string | null;
  created_at: string;
  conversations: Conversation | null;
}

type RoleFilter = 'all' | 'user' | 'assistant' | 'system';
type ContentTypeFilter = 'all' | 'text' | 'image' | 'analysis' | 'audio' | 'document';
type ChannelFilter = 'all' | 'telegram' | 'web';

const PAGE_SIZE = 50;

// Helper: Format relative time
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
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}w ago`;
  if (diffDay < 365) return `${Math.floor(diffDay / 30)}mo ago`;
  return `${Math.floor(diffDay / 365)}y ago`;
}

// Helper: Truncate text
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

// Helper: Get role badge color
function getRoleBadgeClass(role: Message['role']): string {
  switch (role) {
    case 'user':
      return 'bg-blue-600 hover:bg-blue-600';
    case 'assistant':
      return 'bg-green-600 hover:bg-green-600';
    case 'system':
      return 'bg-gray-500 hover:bg-gray-500';
    default:
      return '';
  }
}

// Helper: Get channel badge variant
function getChannelBadgeClass(channel: Message['channel']): string {
  switch (channel) {
    case 'telegram':
      return 'bg-sky-500 hover:bg-sky-500';
    case 'web':
      return 'bg-violet-500 hover:bg-violet-500';
    default:
      return '';
  }
}

// Helper: Get content type badge variant
function getContentTypeBadgeVariant(contentType: Message['content_type']): 'default' | 'secondary' | 'outline' {
  switch (contentType) {
    case 'text':
      return 'secondary';
    case 'image':
    case 'analysis':
      return 'default';
    default:
      return 'outline';
  }
}

// Loading skeleton component
function MessagesTableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </div>
  );
}

// Expanded row details component
function MessageDetails({ message }: { message: Message }) {
  return (
    <Card className="mt-2 mb-4 ml-4 mr-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Message Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Full Content */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Full Content</h4>
          <div className="bg-muted rounded-md p-3">
            <pre className="whitespace-pre-wrap text-sm break-words font-mono">
              {message.content || '(empty)'}
            </pre>
          </div>
        </div>

        {/* Processing Status */}
        {message.processing_status && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Processing Status</h4>
            <Badge variant="outline">{message.processing_status}</Badge>
          </div>
        )}

        {/* Metadata */}
        {message.metadata && Object.keys(message.metadata).length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Metadata</h4>
            <div className="bg-muted rounded-md p-3 overflow-x-auto">
              <pre className="text-xs font-mono">
                {JSON.stringify(message.metadata, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Additional Info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Message ID:</span>
            <code className="ml-2 text-xs bg-muted px-2 py-1 rounded">{message.id}</code>
          </div>
          <div>
            <span className="text-muted-foreground">Conversation ID:</span>
            <code className="ml-2 text-xs bg-muted px-2 py-1 rounded">{message.conversation_id}</code>
          </div>
          {message.interface && (
            <div>
              <span className="text-muted-foreground">Interface:</span>
              <span className="ml-2">{message.interface}</span>
            </div>
          )}
          <div>
            <span className="text-muted-foreground">Created:</span>
            <span className="ml-2">{new Date(message.created_at).toLocaleString('ru-RU')}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function MessagesPage() {
  const { user, isAdmin, isLoading: authLoading, signOut } = useAdminAuth();

  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [contentTypeFilter, setContentTypeFilter] = useState<ContentTypeFilter>('all');
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Expanded rows
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [roleFilter, contentTypeFilter, channelFilter]);

  // Toggle row expansion
  const toggleRowExpansion = (messageId: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const offset = (currentPage - 1) * PAGE_SIZE;

      let query = supabase
        .from('messages')
        .select(`
          id,
          conversation_id,
          channel,
          interface,
          role,
          content,
          content_type,
          metadata,
          processing_status,
          created_at,
          conversations!inner (
            unified_user_id,
            unified_users (
              display_name,
              telegram_id
            )
          )
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      // Apply search filter
      if (debouncedSearch.trim()) {
        query = query.ilike('content', `%${debouncedSearch.trim()}%`);
      }

      // Apply role filter
      if (roleFilter !== 'all') {
        query = query.eq('role', roleFilter);
      }

      // Apply content type filter
      if (contentTypeFilter !== 'all') {
        query = query.eq('content_type', contentTypeFilter);
      }

      // Apply channel filter
      if (channelFilter !== 'all') {
        query = query.eq('channel', channelFilter);
      }

      const { data, count, error: queryError } = await query;

      if (queryError) {
        throw queryError;
      }

      setMessages((data as Message[]) || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error fetching messages:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch messages');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, debouncedSearch, roleFilter, contentTypeFilter, channelFilter]);

  // Fetch on mount and when dependencies change
  useEffect(() => {
    if (!authLoading && isAdmin) {
      fetchMessages();
    }
  }, [authLoading, isAdmin, fetchMessages]);

  // Pagination helpers
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  // Get user display name from message
  const getUserDisplayName = (message: Message): string => {
    const user = message.conversations?.unified_users;
    if (user?.display_name) return user.display_name;
    if (user?.telegram_id) return `TG: ${user.telegram_id}`;
    return 'Unknown';
  };

  // Auth loading state
  if (authLoading) {
    return (
      <AdminLayout title="Messages" userName={user?.email} onLogout={signOut}>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </AdminLayout>
    );
  }

  // Not admin
  if (!isAdmin) {
    return (
      <AdminLayout title="Messages" onLogout={signOut}>
        <div className="flex items-center justify-center h-64">
          <div className="text-destructive">Access denied. Admin privileges required.</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Messages"
      userName={user?.user_metadata?.full_name || user?.email}
      userEmail={user?.email}
      onLogout={signOut}
    >
      <div className="space-y-6">
        {/* Filters */}
        <div className="flex flex-col gap-4">
          {/* Search */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex-1 max-w-md">
              <Input
                placeholder="Search by message content..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchMessages}
              disabled={isLoading}
            >
              Refresh
            </Button>
          </div>

          {/* Filter dropdowns */}
          <div className="flex flex-wrap gap-4">
            {/* Role filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Role:</span>
              <Select
                value={roleFilter}
                onValueChange={(value: RoleFilter) => setRoleFilter(value)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="assistant">Assistant</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Content type filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Type:</span>
              <Select
                value={contentTypeFilter}
                onValueChange={(value: ContentTypeFilter) => setContentTypeFilter(value)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="analysis">Analysis</SelectItem>
                  <SelectItem value="audio">Audio</SelectItem>
                  <SelectItem value="document">Document</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Channel filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Channel:</span>
              <Select
                value={channelFilter}
                onValueChange={(value: ChannelFilter) => setChannelFilter(value)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All channels</SelectItem>
                  <SelectItem value="telegram">Telegram</SelectItem>
                  <SelectItem value="web">Web</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
            <MessagesTableSkeleton />
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              {debouncedSearch || roleFilter !== 'all' || contentTypeFilter !== 'all' || channelFilter !== 'all'
                ? 'No messages found matching your filters'
                : 'No messages found'}
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead className="w-[100px]">Timestamp</TableHead>
                  <TableHead className="w-[150px]">User</TableHead>
                  <TableHead className="w-[100px]">Role</TableHead>
                  <TableHead>Content</TableHead>
                  <TableHead className="w-[100px]">Type</TableHead>
                  <TableHead className="w-[100px]">Channel</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {messages.map((message) => (
                  <React.Fragment key={message.id}>
                    <TableRow
                      onClick={() => toggleRowExpansion(message.id)}
                      className="cursor-pointer"
                    >
                      <TableCell className="text-muted-foreground text-sm">
                        {formatRelativeTime(message.created_at)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {getUserDisplayName(message)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="default"
                          className={`text-xs text-white ${getRoleBadgeClass(message.role)}`}
                        >
                          {message.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-md">
                        <span className="text-sm">
                          {truncateText(message.content || '(empty)', 100)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getContentTypeBadgeVariant(message.content_type)} className="text-xs">
                          {message.content_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="default"
                          className={`text-xs text-white ${getChannelBadgeClass(message.channel)}`}
                        >
                          {message.channel}
                        </Badge>
                      </TableCell>
                    </TableRow>
                    {expandedRows.has(message.id) && (
                      <TableRow>
                        <TableCell colSpan={6} className="p-0 border-0">
                          <MessageDetails message={message} />
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Pagination */}
        {totalCount > 0 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {((currentPage - 1) * PAGE_SIZE) + 1} - {Math.min(currentPage * PAGE_SIZE, totalCount)} of {totalCount} messages
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

export default MessagesPage;
