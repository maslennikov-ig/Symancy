import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { AdminLayout } from '../layout/AdminLayout';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { useAdminTranslations } from '../hooks/useAdminTranslations';
import { formatRelativeTime, truncateText } from '../utils/formatters';
import { PAGE_SIZES, TIME_THRESHOLDS } from '../utils/constants';
import { logger } from '../utils/logger';
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

// User option for combobox
interface UserOption {
  id: string;
  display_name: string | null;
  telegram_id: string | null;
}

const PAGE_SIZE = PAGE_SIZES.MESSAGES;

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
  const { t } = useAdminTranslations();

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

  // User filter
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [debouncedUserSearch, setDebouncedUserSearch] = useState('');
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserLabel, setSelectedUserLabel] = useState<string>('');
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Expanded rows
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, TIME_THRESHOLDS.SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Debounce user search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedUserSearch(userSearchTerm);
    }, TIME_THRESHOLDS.SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [userSearchTerm]);

  // Fetch users for autocomplete
  useEffect(() => {
    if (!isUserDropdownOpen || debouncedUserSearch.length < 1) {
      setUserOptions([]);
      return;
    }

    let cancelled = false;
    setIsLoadingUsers(true);

    async function fetchUsers() {
      try {
        const term = debouncedUserSearch.trim();
        let query = supabase
          .from('unified_users')
          .select('id, display_name, telegram_id')
          .limit(10);

        // Check if search term is numeric (telegram_id search)
        if (/^\d+$/.test(term)) {
          query = query.eq('telegram_id', term);
        } else {
          query = query.ilike('display_name', `%${term}%`);
        }

        const { data, error: queryError } = await query;

        if (queryError) {
          logger.error('Error fetching users for filter', queryError);
          return;
        }

        if (!cancelled) {
          setUserOptions((data as UserOption[]) || []);
        }
      } catch (err) {
        logger.error('Error fetching users for filter', err);
      } finally {
        if (!cancelled) {
          setIsLoadingUsers(false);
        }
      }
    }

    fetchUsers();
    return () => { cancelled = true; };
  }, [debouncedUserSearch, isUserDropdownOpen]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [roleFilter, contentTypeFilter, channelFilter, selectedUserId]);

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

  // Refresh trigger for manual refresh button
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch messages on mount and when dependencies change
  useEffect(() => {
    if (authLoading || !isAdmin) return;

    let cancelled = false;

    async function fetchMessages() {
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

        // Apply user filter
        if (selectedUserId) {
          query = query.eq('conversations.unified_user_id', selectedUserId);
        }

        const { data, count, error: queryError } = await query;

        if (queryError) {
          throw queryError;
        }

        if (!cancelled) {
          setMessages((data as unknown as Message[]) || []);
          setTotalCount(count || 0);
        }
      } catch (err) {
        logger.error('Error fetching messages', err);
        const message = err instanceof Error ? err.message : 'Failed to fetch messages';
        if (!cancelled) {
          setError(message);
          toast.error('Failed to fetch messages', { description: message });
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchMessages();

    return () => {
      cancelled = true;
    };
  }, [authLoading, isAdmin, currentPage, debouncedSearch, roleFilter, contentTypeFilter, channelFilter, selectedUserId, refreshTrigger]);

  // Handle manual refresh
  const handleRefresh = () => setRefreshTrigger((prev) => prev + 1);

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
      <AdminLayout title={t('admin.messages.title')} userName={user?.email} onLogout={signOut}>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">{t('admin.common.loading')}</div>
        </div>
      </AdminLayout>
    );
  }

  // Not admin
  if (!isAdmin) {
    return (
      <AdminLayout title={t('admin.messages.title')} onLogout={signOut}>
        <div className="flex items-center justify-center h-64">
          <div className="text-destructive">{t('admin.forbidden.message')}</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title={t('admin.messages.title')}
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
                placeholder={t('admin.messages.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
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

          {/* Filter dropdowns */}
          <div className="flex flex-wrap gap-4">
            {/* Role filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{t('admin.messages.role')}:</span>
              <Select
                value={roleFilter}
                onValueChange={(value: RoleFilter) => setRoleFilter(value)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('admin.messages.allRoles')}</SelectItem>
                  <SelectItem value="user">{t('admin.messages.user')}</SelectItem>
                  <SelectItem value="assistant">{t('admin.messages.assistant')}</SelectItem>
                  <SelectItem value="system">{t('admin.messages.system')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Content type filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{t('admin.messages.type')}:</span>
              <Select
                value={contentTypeFilter}
                onValueChange={(value: ContentTypeFilter) => setContentTypeFilter(value)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('admin.messages.allTypes')}</SelectItem>
                  <SelectItem value="text">{t('admin.messages.text')}</SelectItem>
                  <SelectItem value="image">{t('admin.messages.image')}</SelectItem>
                  <SelectItem value="analysis">{t('admin.messages.analysis')}</SelectItem>
                  <SelectItem value="audio">{t('admin.messages.audio')}</SelectItem>
                  <SelectItem value="document">{t('admin.messages.document')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Channel filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{t('admin.messages.channel')}:</span>
              <Select
                value={channelFilter}
                onValueChange={(value: ChannelFilter) => setChannelFilter(value)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('admin.messages.allChannels')}</SelectItem>
                  <SelectItem value="telegram">Telegram</SelectItem>
                  <SelectItem value="web">Web</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* User filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{t('admin.messages.user')}:</span>
              <div className="relative">
                {selectedUserId ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="py-1.5 px-3">
                      {selectedUserLabel}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => {
                        setSelectedUserId(null);
                        setSelectedUserLabel('');
                        setUserSearchTerm('');
                      }}
                    >
                      ×
                    </Button>
                  </div>
                ) : (
                  <>
                    <Input
                      placeholder={t('admin.messages.searchUser')}
                      value={userSearchTerm}
                      onChange={(e) => setUserSearchTerm(e.target.value)}
                      onFocus={() => setIsUserDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setIsUserDropdownOpen(false), 200)}
                      className="w-[200px]"
                    />
                    {isUserDropdownOpen && (userOptions.length > 0 || isLoadingUsers) && (
                      <div className="absolute top-full left-0 w-full mt-1 bg-popover border rounded-md shadow-md z-50 max-h-[200px] overflow-y-auto">
                        {isLoadingUsers ? (
                          <div className="p-2 text-sm text-muted-foreground">
                            {t('admin.common.loading')}
                          </div>
                        ) : (
                          userOptions.map((userOption) => (
                            <button
                              key={userOption.id}
                              type="button"
                              className="w-full text-left px-3 py-2 hover:bg-accent text-sm cursor-pointer"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                const label = userOption.display_name || `TG: ${userOption.telegram_id}` || userOption.id.slice(0, 8);
                                setSelectedUserId(userOption.id);
                                setSelectedUserLabel(label);
                                setUserSearchTerm('');
                                setIsUserDropdownOpen(false);
                              }}
                            >
                              <div className="font-medium">
                                {userOption.display_name || t('admin.userDetail.unnamed')}
                              </div>
                              {userOption.telegram_id && (
                                <div className="text-xs text-muted-foreground">
                                  TG: {userOption.telegram_id}
                                </div>
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
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
            <MessagesTableSkeleton />
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              {t('admin.messages.noMessages')}
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
                      onKeyDown={(e) => e.key === 'Enter' && toggleRowExpansion(message.id)}
                      tabIndex={0}
                      role="button"
                      aria-label={`View details for message from ${getUserDisplayName(message)}`}
                      aria-expanded={expandedRows.has(message.id)}
                      className="cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
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
              {t('admin.messages.total')}: {totalCount}
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
