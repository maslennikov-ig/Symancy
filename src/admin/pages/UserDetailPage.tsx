// @ts-nocheck - Bypass library type conflicts with React 19
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { supabase } from '@/lib/supabaseClient';
import { AdminLayout } from '../layout/AdminLayout';
import { useAdminAuth } from '../hooks/useAdminAuth';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

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
  language_code: string;
  created_at: string;
  last_active_at: string | null;
  is_banned: boolean;
  onboarding_completed: boolean;
  primary_interface: string;
}

interface Message {
  id: string;
  role: string;
  content: string;
  channel: string;
  created_at: string;
}

interface Analysis {
  id: string;
  analysis_type: string;
  model_used: string | null;
  tokens_used: number | null;
  status: string;
  created_at: string;
}

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

// Helper: Format full date
function formatFullDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Helper: Truncate text
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

// Loading skeleton for user info
function UserInfoSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-4 w-44" />
    </div>
  );
}

// Credits display with badges
function CreditsBadges({ credits }: { credits: UserCredits | null }) {
  if (!credits) {
    return <span className="text-muted-foreground text-sm">No credits data</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant="secondary" className="text-sm px-3 py-1">
        Basic: {credits.credits_basic}
      </Badge>
      <Badge variant="default" className="text-sm px-3 py-1 bg-blue-600">
        Pro: {credits.credits_pro}
      </Badge>
      <Badge variant="default" className="text-sm px-3 py-1 bg-purple-600">
        Cassandra: {credits.credits_cassandra}
      </Badge>
    </div>
  );
}

// Status badge for analysis
function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
    completed: { variant: 'default', className: 'bg-green-600' },
    processing: { variant: 'secondary', className: 'bg-yellow-500' },
    pending: { variant: 'outline' },
    failed: { variant: 'destructive' },
  };

  const config = variants[status] || { variant: 'outline' };

  return (
    <Badge variant={config.variant} className={config.className}>
      {status}
    </Badge>
  );
}

// Role badge for messages
function RoleBadge({ role }: { role: string }) {
  if (role === 'user') {
    return <Badge variant="outline">User</Badge>;
  }
  if (role === 'assistant') {
    return <Badge variant="secondary">Assistant</Badge>;
  }
  return <Badge variant="outline">{role}</Badge>;
}

// Channel badge
function ChannelBadge({ channel }: { channel: string }) {
  const colors: Record<string, string> = {
    telegram: 'bg-blue-500',
    web: 'bg-green-500',
    whatsapp: 'bg-emerald-500',
    wechat: 'bg-lime-500',
  };

  return (
    <Badge variant="default" className={colors[channel] || 'bg-gray-500'}>
      {channel}
    </Badge>
  );
}

export function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: adminUser, isAdmin, isLoading: authLoading, signOut } = useAdminAuth();

  // User data state
  const [userData, setUserData] = useState<UnifiedUser | null>(null);
  const [credits, setCredits] = useState<UserCredits | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Credit adjustment state
  const [isEditingCredits, setIsEditingCredits] = useState(false);
  const [basicDelta, setBasicDelta] = useState(0);
  const [proDelta, setProDelta] = useState(0);
  const [cassandraDelta, setCassandraDelta] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Fetch all user data
  const fetchUserData = useCallback(async () => {
    if (!id) return;

    setIsLoading(true);
    setError(null);

    try {
      // Fetch user info
      const { data: user, error: userError } = await supabase
        .from('unified_users')
        .select('*')
        .eq('id', id)
        .single();

      if (userError) throw userError;
      setUserData(user);

      // Fetch credits
      const { data: creditsData, error: creditsError } = await supabase
        .from('unified_user_credits')
        .select('credits_basic, credits_pro, credits_cassandra')
        .eq('unified_user_id', id)
        .single();

      if (creditsError && creditsError.code !== 'PGRST116') {
        console.error('Error fetching credits:', creditsError);
      }
      setCredits(creditsData || { credits_basic: 0, credits_pro: 0, credits_cassandra: 0 });

      // Fetch recent messages (last 10)
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select(`
          id,
          role,
          content,
          channel,
          created_at,
          conversations!inner(unified_user_id)
        `)
        .eq('conversations.unified_user_id', id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (messagesError) {
        console.error('Error fetching messages:', messagesError);
      }
      setMessages(messagesData || []);

      // Fetch recent analyses (last 5)
      const { data: analysesData, error: analysesError } = await supabase
        .from('analysis_history')
        .select('id, analysis_type, model_used, tokens_used, status, created_at')
        .eq('unified_user_id', id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (analysesError) {
        console.error('Error fetching analyses:', analysesError);
      }
      setAnalyses(analysesData || []);

    } catch (err) {
      console.error('Error fetching user data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch user data');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  // Fetch on mount
  useEffect(() => {
    if (!authLoading && isAdmin && id) {
      fetchUserData();
    }
  }, [authLoading, isAdmin, id, fetchUserData]);

  // Handle credit adjustment
  const handleAdjustCredits = async () => {
    if (!id) return;
    if (basicDelta === 0 && proDelta === 0 && cassandraDelta === 0) {
      setSaveError('Please specify at least one credit adjustment');
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const { data, error: rpcError } = await supabase.rpc('admin_adjust_credits', {
        p_unified_user_id: id,
        p_basic_delta: basicDelta,
        p_pro_delta: proDelta,
        p_cassandra_delta: cassandraDelta,
        p_reason: adjustReason || 'admin_adjustment',
      });

      if (rpcError) throw rpcError;

      // Update local state with new credits
      setCredits({
        credits_basic: data.credits_basic,
        credits_pro: data.credits_pro,
        credits_cassandra: data.credits_cassandra,
      });

      // Reset form
      setBasicDelta(0);
      setProDelta(0);
      setCassandraDelta(0);
      setAdjustReason('');
      setIsEditingCredits(false);
      setSaveSuccess(true);

      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);

    } catch (err) {
      console.error('Error adjusting credits:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to adjust credits');
    } finally {
      setIsSaving(false);
    }
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setBasicDelta(0);
    setProDelta(0);
    setCassandraDelta(0);
    setAdjustReason('');
    setIsEditingCredits(false);
    setSaveError(null);
  };

  // Auth loading state
  if (authLoading) {
    return (
      <AdminLayout title="User Details" userName={adminUser?.email} onLogout={signOut}>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </AdminLayout>
    );
  }

  // Not admin
  if (!isAdmin) {
    return (
      <AdminLayout title="User Details" onLogout={signOut}>
        <div className="flex items-center justify-center h-64">
          <div className="text-destructive">Access denied. Admin privileges required.</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="User Details"
      userName={adminUser?.user_metadata?.full_name || adminUser?.email}
      userEmail={adminUser?.email}
      onLogout={signOut}
    >
      <div className="space-y-6">
        {/* Back button and header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/admin/users')}
            className="gap-2"
          >
            <span>&larr;</span> Back to Users
          </Button>
          {userData && (
            <h1 className="text-2xl font-bold">
              {userData.display_name || 'Unnamed User'}
            </h1>
          )}
        </div>

        {/* Error state */}
        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        {/* Success message */}
        {saveSuccess && (
          <div className="bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-4 py-3 rounded-md">
            Credits adjusted successfully!
          </div>
        )}

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column: User Info + Credits */}
          <div className="space-y-6">
            {/* User Info Card */}
            <Card>
              <CardHeader>
                <CardTitle>User Information</CardTitle>
                <CardDescription>Basic profile details</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <UserInfoSkeleton />
                ) : userData ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Label className="text-muted-foreground w-32">Telegram ID:</Label>
                      {userData.telegram_id ? (
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {userData.telegram_id}
                        </code>
                      ) : (
                        <Badge variant="outline">Web User</Badge>
                      )}
                    </div>

                    <Separator />

                    <div className="flex items-center gap-2">
                      <Label className="text-muted-foreground w-32">Display Name:</Label>
                      <span>{userData.display_name || '-'}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Label className="text-muted-foreground w-32">Language:</Label>
                      <Badge variant="outline">{userData.language_code?.toUpperCase() || 'RU'}</Badge>
                    </div>

                    <div className="flex items-center gap-2">
                      <Label className="text-muted-foreground w-32">Interface:</Label>
                      <Badge variant="secondary">{userData.primary_interface}</Badge>
                    </div>

                    <Separator />

                    <div className="flex items-center gap-2">
                      <Label className="text-muted-foreground w-32">Created:</Label>
                      <span className="text-sm">{formatFullDate(userData.created_at)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Label className="text-muted-foreground w-32">Last Active:</Label>
                      <span className="text-sm">
                        {userData.last_active_at ? formatRelativeTime(userData.last_active_at) : '-'}
                      </span>
                    </div>

                    <Separator />

                    <div className="flex items-center gap-2">
                      <Label className="text-muted-foreground w-32">Onboarding:</Label>
                      <Badge variant={userData.onboarding_completed ? 'default' : 'outline'}>
                        {userData.onboarding_completed ? 'Completed' : 'Incomplete'}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2">
                      <Label className="text-muted-foreground w-32">Status:</Label>
                      <Badge variant={userData.is_banned ? 'destructive' : 'default'}>
                        {userData.is_banned ? 'Banned' : 'Active'}
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <div className="text-muted-foreground">User not found</div>
                )}
              </CardContent>
            </Card>

            {/* Credit Management Card */}
            <Card>
              <CardHeader>
                <CardTitle>Credit Management</CardTitle>
                <CardDescription>View and adjust user credits</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-20 w-full" />
                ) : (
                  <div className="space-y-4">
                    {/* Current balances */}
                    <div>
                      <Label className="text-muted-foreground text-sm mb-2 block">Current Balance:</Label>
                      <CreditsBadges credits={credits} />
                    </div>

                    <Separator />

                    {/* Edit mode toggle */}
                    {!isEditingCredits ? (
                      <Button
                        variant="outline"
                        onClick={() => setIsEditingCredits(true)}
                      >
                        Adjust Credits
                      </Button>
                    ) : (
                      <div className="space-y-4">
                        <Label className="text-sm font-medium">Credit Adjustments (+ or -):</Label>

                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label htmlFor="basic-delta" className="text-xs text-muted-foreground">
                              Basic
                            </Label>
                            <Input
                              id="basic-delta"
                              type="number"
                              value={basicDelta}
                              onChange={(e) => setBasicDelta(parseInt(e.target.value) || 0)}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor="pro-delta" className="text-xs text-muted-foreground">
                              Pro
                            </Label>
                            <Input
                              id="pro-delta"
                              type="number"
                              value={proDelta}
                              onChange={(e) => setProDelta(parseInt(e.target.value) || 0)}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor="cassandra-delta" className="text-xs text-muted-foreground">
                              Cassandra
                            </Label>
                            <Input
                              id="cassandra-delta"
                              type="number"
                              value={cassandraDelta}
                              onChange={(e) => setCassandraDelta(parseInt(e.target.value) || 0)}
                              className="mt-1"
                            />
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="reason" className="text-xs text-muted-foreground">
                            Reason (for audit log)
                          </Label>
                          <Input
                            id="reason"
                            type="text"
                            placeholder="e.g., compensation, bonus, correction"
                            value={adjustReason}
                            onChange={(e) => setAdjustReason(e.target.value)}
                            className="mt-1"
                          />
                        </div>

                        {saveError && (
                          <div className="text-destructive text-sm">{saveError}</div>
                        )}

                        <div className="flex gap-2">
                          <Button
                            onClick={handleAdjustCredits}
                            disabled={isSaving}
                          >
                            {isSaving ? 'Saving...' : 'Save Changes'}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={handleCancelEdit}
                            disabled={isSaving}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right column: Recent Activity */}
          <div className="space-y-6">
            {/* Recent Messages Card */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Messages</CardTitle>
                <CardDescription>Last 10 messages from this user</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-muted-foreground text-center py-8">
                    No messages found
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[100px]">Time</TableHead>
                          <TableHead className="w-[80px]">Role</TableHead>
                          <TableHead>Content</TableHead>
                          <TableHead className="w-[80px]">Channel</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {messages.map((message) => (
                          <TableRow key={message.id}>
                            <TableCell className="text-xs text-muted-foreground">
                              {formatRelativeTime(message.created_at)}
                            </TableCell>
                            <TableCell>
                              <RoleBadge role={message.role} />
                            </TableCell>
                            <TableCell className="max-w-[200px]">
                              <span className="text-sm" title={message.content}>
                                {truncateText(message.content, 50)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <ChannelBadge channel={message.channel} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Analyses Card */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Analyses</CardTitle>
                <CardDescription>Last 5 coffee readings</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : analyses.length === 0 ? (
                  <div className="text-muted-foreground text-center py-8">
                    No analyses found
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[100px]">Time</TableHead>
                          <TableHead className="w-[80px]">Type</TableHead>
                          <TableHead>Model</TableHead>
                          <TableHead className="w-[80px]">Tokens</TableHead>
                          <TableHead className="w-[90px]">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analyses.map((analysis) => (
                          <TableRow key={analysis.id}>
                            <TableCell className="text-xs text-muted-foreground">
                              {formatRelativeTime(analysis.created_at)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  analysis.analysis_type === 'cassandra'
                                    ? 'default'
                                    : analysis.analysis_type === 'pro'
                                    ? 'secondary'
                                    : 'outline'
                                }
                                className={
                                  analysis.analysis_type === 'cassandra'
                                    ? 'bg-purple-600'
                                    : analysis.analysis_type === 'pro'
                                    ? 'bg-blue-600'
                                    : ''
                                }
                              >
                                {analysis.analysis_type}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {analysis.model_used || '-'}
                            </TableCell>
                            <TableCell className="text-sm">
                              {analysis.tokens_used?.toLocaleString() || '-'}
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={analysis.status} />
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
        </div>
      </div>
    </AdminLayout>
  );
}

export default UserDetailPage;
