import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { AdminLayout } from '../layout/AdminLayout';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { formatRelativeTime, formatFullDate, truncateText } from '../utils/formatters';
import { MAX_CREDIT_ADJUSTMENT, TIME_THRESHOLDS } from '../utils/constants';
import { logger } from '../utils/logger';
import { CreditsBadges, CreditBadge, type UserCredits } from '../components/CreditBadge';
import { UserInfoSkeleton, ListSkeleton } from '../components/skeletons';
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
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleRetry = () => setRefreshTrigger(prev => prev + 1);

  // Fetch all user data on mount
  useEffect(() => {
    if (authLoading || !isAdmin || !id) return;

    let cancelled = false;

    async function fetchUserData() {
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
        if (!cancelled) {
          setUserData(user as UnifiedUser);
        }

        // Fetch credits
        const { data: creditsData, error: creditsError } = await supabase
          .from('unified_user_credits')
          .select('credits_basic, credits_pro, credits_cassandra')
          .eq('unified_user_id', id)
          .single();

        if (creditsError && creditsError.code !== 'PGRST116') {
          logger.error('Error fetching credits', creditsError);
        }
        if (!cancelled) {
          setCredits((creditsData as UserCredits | null) || { credits_basic: 0, credits_pro: 0, credits_cassandra: 0 });
        }

        // Fetch recent messages (last 10)
        const messagesQuery = 'id, role, content, channel, created_at, conversations!inner(unified_user_id)';
        const { data: messagesData, error: messagesError } = await supabase
          .from('messages')
          .select(messagesQuery)
          .eq('conversations.unified_user_id', id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (messagesError) {
          logger.error('Error fetching messages', messagesError);
        }
        if (!cancelled) {
          setMessages((messagesData as Message[] | null) || []);
        }

        // Fetch recent analyses (last 5)
        const { data: analysesData, error: analysesError } = await supabase
          .from('analysis_history')
          .select('id, analysis_type, model_used, tokens_used, status, created_at')
          .eq('unified_user_id', id)
          .order('created_at', { ascending: false })
          .limit(5);

        if (analysesError) {
          logger.error('Error fetching analyses', analysesError);
        }
        if (!cancelled) {
          setAnalyses((analysesData as Analysis[] | null) || []);
        }

      } catch (err) {
        logger.error('Error fetching user data', err);
        const message = err instanceof Error ? err.message : 'Failed to fetch user data';
        if (!cancelled) {
          setError(message);
          toast.error('Failed to load user data', { description: message });
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchUserData();

    return () => {
      cancelled = true;
    };
  }, [authLoading, isAdmin, id, refreshTrigger]);

  // Handle credit adjustment
  const handleAdjustCredits = async () => {
    if (!id) return;
    if (basicDelta === 0 && proDelta === 0 && cassandraDelta === 0) {
      setSaveError('Please specify at least one credit adjustment');
      return;
    }

    // Input validation: check adjustment limits
    if (Math.abs(basicDelta) > MAX_CREDIT_ADJUSTMENT.basic) {
      setSaveError('Basic credit adjustment must be between -' + MAX_CREDIT_ADJUSTMENT.basic + ' and +' + MAX_CREDIT_ADJUSTMENT.basic);
      return;
    }
    if (Math.abs(proDelta) > MAX_CREDIT_ADJUSTMENT.pro) {
      setSaveError('Pro credit adjustment must be between -' + MAX_CREDIT_ADJUSTMENT.pro + ' and +' + MAX_CREDIT_ADJUSTMENT.pro);
      return;
    }
    if (Math.abs(cassandraDelta) > MAX_CREDIT_ADJUSTMENT.cassandra) {
      setSaveError('Cassandra credit adjustment must be between -' + MAX_CREDIT_ADJUSTMENT.cassandra + ' and +' + MAX_CREDIT_ADJUSTMENT.cassandra);
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

      // RPC error validation
      if (rpcError) {
        throw new Error(rpcError.message);
      }

      // RPC response validation: check for null/undefined data
      if (!data) {
        throw new Error('RPC admin_adjust_credits returned no data');
      }

      // Validate response structure
      const result = data as { credits_basic: number; credits_pro: number; credits_cassandra: number };
      if (typeof result.credits_basic !== 'number') {
        throw new Error('Invalid RPC response: missing or invalid credits_basic');
      }
      if (typeof result.credits_pro !== 'number') {
        throw new Error('Invalid RPC response: missing or invalid credits_pro');
      }
      if (typeof result.credits_cassandra !== 'number') {
        throw new Error('Invalid RPC response: missing or invalid credits_cassandra');
      }

      // Update local state with new credits
      setCredits({
        credits_basic: result.credits_basic,
        credits_pro: result.credits_pro,
        credits_cassandra: result.credits_cassandra,
      });

      // Reset form
      setBasicDelta(0);
      setProDelta(0);
      setCassandraDelta(0);
      setAdjustReason('');
      setIsEditingCredits(false);
      setSaveSuccess(true);
      toast.success('Credits adjusted', { description: 'User credits have been updated successfully.' });

      // Clear success message after configured duration
      setTimeout(() => setSaveSuccess(false), TIME_THRESHOLDS.SUCCESS_MESSAGE_DURATION_MS);

    } catch (err) {
      logger.error('Error adjusting credits', err);
      const message = err instanceof Error ? err.message : 'Failed to adjust credits';
      setSaveError(message);
      toast.error('Failed to adjust credits', { description: message });
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
          <div className="flex items-center justify-between gap-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
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
                      <CreditsBadges credits={credits} nullText="No credits data" />
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
                  <ListSkeleton items={5} />
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
                  <ListSkeleton items={3} />
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
                              <CreditBadge
                                type={analysis.analysis_type as 'basic' | 'pro' | 'cassandra'}
                                amount={1}
                              />
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
