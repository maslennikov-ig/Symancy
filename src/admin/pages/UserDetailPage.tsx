import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { AdminLayout } from '../layout/AdminLayout';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { useAdminTranslations } from '../hooks/useAdminTranslations';
import { formatRelativeTime, formatFullDate, truncateText } from '../utils/formatters';
import { sanitizeDisplayName } from '../utils/sanitize';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Ban, Shield, ShieldOff, Trash2 } from 'lucide-react';
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
  auth_id: string | null;
  email: string | null;
  display_name: string | null;
  language_code: string;
  created_at: string;
  last_active_at: string | null;
  is_banned: boolean;
  onboarding_completed: boolean;
  primary_interface: string;
}

// Helper to determine user type
function getUserType(user: UnifiedUser): 'linked' | 'telegram' | 'web' {
  if (user.telegram_id && user.auth_id) return 'linked';
  if (user.telegram_id) return 'telegram';
  return 'web';
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
  const { t } = useAdminTranslations();

  // User data state
  const [userData, setUserData] = useState<UnifiedUser | null>(null);
  const [credits, setCredits] = useState<UserCredits | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Credit adjustment state
  const [isEditingCredits, setIsEditingCredits] = useState(false);
  const [adjustmentMode, setAdjustmentMode] = useState<'adjust' | 'set'>('set'); // 'set' is default now
  const [basicValue, setBasicValue] = useState(0);
  const [proValue, setProValue] = useState(0);
  const [cassandraValue, setCassandraValue] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Admin actions state
  const [isBanProcessing, setIsBanProcessing] = useState(false);
  const [isDeleteProcessing, setIsDeleteProcessing] = useState(false);
  const [isAdminToggleProcessing, setIsAdminToggleProcessing] = useState(false);
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [adminDialogOpen, setAdminDialogOpen] = useState(false);

  // Admin status for this user
  const [isUserAdmin, setIsUserAdmin] = useState(false);
  const [adminStatusLoading, setAdminStatusLoading] = useState(false);

  // Ref for success message timeout cleanup
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRetry = () => setRefreshTrigger(prev => prev + 1);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

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

  // Load admin status when user data is available and user has email
  useEffect(() => {
    if (!userData?.email || !id) return;

    let cancelled = false;
    setAdminStatusLoading(true);

    async function loadAdminStatus() {
      try {
        const { data, error } = await supabase.rpc('admin_get_user_admin_status', {
          p_unified_user_id: id,
        });

        if (error) {
          logger.error('Error loading admin status', error);
          return;
        }

        if (!cancelled && data && data.length > 0) {
          setIsUserAdmin(data[0].is_admin);
        }
      } catch (err) {
        logger.error('Error loading admin status', err);
      } finally {
        if (!cancelled) {
          setAdminStatusLoading(false);
        }
      }
    }

    loadAdminStatus();
    return () => { cancelled = true; };
  }, [userData?.email, id]);

  // Handle credit adjustment (no optimistic updates to avoid race conditions)
  const handleAdjustCredits = async () => {
    if (!id) return;

    // Calculate deltas based on mode
    let basicDelta: number;
    let proDelta: number;
    let cassandraDelta: number;

    if (adjustmentMode === 'set') {
      // In 'set' mode, calculate delta from current values
      const currentBasic = credits?.credits_basic ?? 0;
      const currentPro = credits?.credits_pro ?? 0;
      const currentCassandra = credits?.credits_cassandra ?? 0;

      basicDelta = basicValue - currentBasic;
      proDelta = proValue - currentPro;
      cassandraDelta = cassandraValue - currentCassandra;
    } else {
      // In 'adjust' mode, values ARE deltas
      basicDelta = basicValue;
      proDelta = proValue;
      cassandraDelta = cassandraValue;
    }

    if (basicDelta === 0 && proDelta === 0 && cassandraDelta === 0) {
      setSaveError(t('admin.userDetail.noAdjustmentError'));
      return;
    }

    // Input validation: check adjustment limits
    if (Math.abs(basicDelta) > MAX_CREDIT_ADJUSTMENT.basic) {
      setSaveError(
        t('admin.userDetail.creditAdjustmentError')
          .replace(/{max}/g, String(MAX_CREDIT_ADJUSTMENT.basic))
      );
      return;
    }
    if (Math.abs(proDelta) > MAX_CREDIT_ADJUSTMENT.pro) {
      setSaveError(
        t('admin.userDetail.creditAdjustmentError')
          .replace(/{max}/g, String(MAX_CREDIT_ADJUSTMENT.pro))
      );
      return;
    }
    if (Math.abs(cassandraDelta) > MAX_CREDIT_ADJUSTMENT.cassandra) {
      setSaveError(
        t('admin.userDetail.creditAdjustmentError')
          .replace(/{max}/g, String(MAX_CREDIT_ADJUSTMENT.cassandra))
      );
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
        p_reason: adjustReason || (adjustmentMode === 'set' ? 'admin_set_balance' : 'admin_adjustment'),
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

      // Update credits with server response (source of truth)
      setCredits({
        credits_basic: result.credits_basic,
        credits_pro: result.credits_pro,
        credits_cassandra: result.credits_cassandra,
      });

      // Reset form
      setBasicValue(0);
      setProValue(0);
      setCassandraValue(0);
      setAdjustReason('');
      setIsEditingCredits(false);
      setSaveSuccess(true);
      toast.success(t('admin.userDetail.creditsSuccess'));

      // Clear success message after configured duration
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
      successTimeoutRef.current = setTimeout(() => {
        setSaveSuccess(false);
        successTimeoutRef.current = null;
      }, TIME_THRESHOLDS.SUCCESS_MESSAGE_DURATION_MS);

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
    setBasicValue(0);
    setProValue(0);
    setCassandraValue(0);
    setAdjustReason('');
    setIsEditingCredits(false);
    setSaveError(null);
  };

  // Start editing credits - initialize values based on mode
  const handleStartEdit = () => {
    if (adjustmentMode === 'set') {
      // In 'set' mode, start with current balance
      setBasicValue(credits?.credits_basic ?? 0);
      setProValue(credits?.credits_pro ?? 0);
      setCassandraValue(credits?.credits_cassandra ?? 0);
    } else {
      // In 'adjust' mode, start with 0 delta
      setBasicValue(0);
      setProValue(0);
      setCassandraValue(0);
    }
    setAdjustReason('');
    setSaveError(null);
    setIsEditingCredits(true);
  };

  // Handle mode change
  const handleModeChange = (mode: 'adjust' | 'set') => {
    setAdjustmentMode(mode);
    if (mode === 'set') {
      setBasicValue(credits?.credits_basic ?? 0);
      setProValue(credits?.credits_pro ?? 0);
      setCassandraValue(credits?.credits_cassandra ?? 0);
    } else {
      setBasicValue(0);
      setProValue(0);
      setCassandraValue(0);
    }
    setSaveError(null);
  };

  // Handle ban/unban user
  const handleToggleBan = async () => {
    if (!id || !userData) return;
    setIsBanProcessing(true);
    try {
      const { error } = await supabase.rpc('admin_toggle_ban', {
        p_user_id: id,
        p_is_banned: !userData.is_banned,
        p_reason: null
      });
      if (error) throw error;
      toast.success(userData.is_banned ? t('admin.users.unbanSuccess') : t('admin.users.banSuccess'));
      setRefreshTrigger(prev => prev + 1);
      setBanDialogOpen(false);
    } catch (err) {
      logger.error('Error toggling ban', err);
      toast.error(t('admin.users.actionFailed'));
    } finally {
      setIsBanProcessing(false);
    }
  };

  // Handle delete user
  const handleDeleteUser = async () => {
    if (!id) return;
    setIsDeleteProcessing(true);
    try {
      const { error } = await supabase.rpc('admin_delete_user', {
        p_user_id: id,
        p_reason: null
      });
      if (error) throw error;
      toast.success(t('admin.users.deleteSuccess'));
      setDeleteDialogOpen(false);
      navigate('/admin/users');
    } catch (err) {
      logger.error('Error deleting user', err);
      toast.error(t('admin.users.actionFailed'));
    } finally {
      setIsDeleteProcessing(false);
    }
  };

  // Handle admin toggle (grant/revoke)
  const handleAdminToggle = async () => {
    if (!id || !userData?.email) return;
    setIsAdminToggleProcessing(true);
    try {
      const rpcName = isUserAdmin ? 'admin_remove_admin_email' : 'admin_add_admin_email';
      const { error } = await supabase.rpc(rpcName, {
        p_email: userData.email,
      });
      if (error) throw error;
      toast.success(
        isUserAdmin
          ? t('admin.users.revokeAdminSuccess')
          : t('admin.users.grantAdminSuccess')
      );
      setIsUserAdmin(!isUserAdmin);
      setAdminDialogOpen(false);
    } catch (err) {
      logger.error('Error toggling admin', err);
      toast.error(t('admin.users.actionFailed'));
    } finally {
      setIsAdminToggleProcessing(false);
    }
  };

  // Auth loading state
  if (authLoading) {
    return (
      <AdminLayout title={t('admin.userDetail.title')} userName={adminUser?.email} onLogout={signOut}>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">{t('admin.common.loading')}</div>
        </div>
      </AdminLayout>
    );
  }

  // Not admin
  if (!isAdmin) {
    return (
      <AdminLayout title={t('admin.userDetail.title')} onLogout={signOut}>
        <div className="flex items-center justify-center h-64">
          <div className="text-destructive">{t('admin.forbidden.message')}</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title={t('admin.userDetail.title')}
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
            <span>&larr;</span> {t('admin.userDetail.backToUsers')}
          </Button>
          {userData && (
            <h1 className="text-2xl font-bold">
              {sanitizeDisplayName(userData.display_name, t('admin.userDetail.unnamed'))}
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
              {t('admin.common.retry')}
            </Button>
          </div>
        )}

        {/* Success message */}
        {saveSuccess && (
          <div className="bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-4 py-3 rounded-md">
            {t('admin.userDetail.creditsSuccess')}
          </div>
        )}

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column: User Info + Credits */}
          <div className="space-y-6">
            {/* User Info Card */}
            <Card>
              <CardHeader>
                <CardTitle>{t('admin.userDetail.info')}</CardTitle>
                <CardDescription>{t('admin.userDetail.profileDetails')}</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <UserInfoSkeleton />
                ) : userData ? (
                  <div className="space-y-4">
                    {/* User Type */}
                    <div className="flex items-center gap-2">
                      <Label className="text-muted-foreground w-32">{t('admin.userDetail.userType')}:</Label>
                      {(() => {
                        const userType = getUserType(userData);
                        if (userType === 'linked') {
                          return <Badge variant="default" className="bg-purple-600">🔗 {t('admin.users.linked')}</Badge>;
                        } else if (userType === 'telegram') {
                          return <Badge variant="secondary">📱 {t('admin.users.telegram')}</Badge>;
                        } else {
                          return <Badge variant="outline">🌐 {t('admin.users.web')}</Badge>;
                        }
                      })()}
                      {/* Admin badge */}
                      {userData.email && !adminStatusLoading && isUserAdmin && (
                        <Badge variant="destructive" className="ml-2">
                          <Shield className="h-3 w-3 mr-1" />
                          Admin
                        </Badge>
                      )}
                    </div>

                    <Separator />

                    {/* Email - for web/linked users */}
                    {userData.email && (
                      <div className="flex items-center gap-2">
                        <Label className="text-muted-foreground w-32">Email:</Label>
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {userData.email}
                        </code>
                      </div>
                    )}

                    {/* Telegram ID */}
                    {userData.telegram_id && (
                      <div className="flex items-center gap-2">
                        <Label className="text-muted-foreground w-32">Telegram ID:</Label>
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {userData.telegram_id}
                        </code>
                      </div>
                    )}

                    <Separator />

                    <div className="flex items-center gap-2">
                      <Label className="text-muted-foreground w-32">{t('admin.userDetail.displayName')}:</Label>
                      <span>{sanitizeDisplayName(userData.display_name, '-')}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Label className="text-muted-foreground w-32">{t('admin.userDetail.language')}:</Label>
                      <Badge variant="outline">{userData.language_code?.toUpperCase() || 'RU'}</Badge>
                    </div>

                    <div className="flex items-center gap-2">
                      <Label className="text-muted-foreground w-32">{t('admin.userDetail.interface')}:</Label>
                      <Badge variant="secondary">{userData.primary_interface}</Badge>
                    </div>

                    <Separator />

                    <div className="flex items-center gap-2">
                      <Label className="text-muted-foreground w-32">{t('admin.userDetail.created')}:</Label>
                      <span className="text-sm">{formatFullDate(userData.created_at)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Label className="text-muted-foreground w-32">{t('admin.userDetail.lastActive')}:</Label>
                      <span className="text-sm">
                        {userData.last_active_at ? formatRelativeTime(userData.last_active_at) : '-'}
                      </span>
                    </div>

                    <Separator />

                    <div className="flex items-center gap-2">
                      <Label className="text-muted-foreground w-32">{t('admin.userDetail.onboarding')}:</Label>
                      <Badge variant={userData.onboarding_completed ? 'default' : 'outline'}>
                        {userData.onboarding_completed ? t('admin.userDetail.completed') : t('admin.userDetail.incomplete')}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2">
                      <Label className="text-muted-foreground w-32">{t('admin.userDetail.status')}:</Label>
                      <Badge variant={userData.is_banned ? 'destructive' : 'default'}>
                        {userData.is_banned ? t('admin.userDetail.banned') : t('admin.userDetail.active')}
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <div className="text-muted-foreground">{t('admin.userDetail.notFound')}</div>
                )}
              </CardContent>
            </Card>

            {/* Credit Management Card */}
            <Card>
              <CardHeader>
                <CardTitle>{t('admin.userDetail.credits')}</CardTitle>
                <CardDescription>{t('admin.userDetail.viewAdjust')}</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-20 w-full" />
                ) : (
                  <div className="space-y-4">
                    {/* Current balances */}
                    <div>
                      <Label className="text-muted-foreground text-sm mb-2 block">{t('admin.userDetail.currentBalance')}:</Label>
                      <CreditsBadges credits={credits} nullText={t('admin.userDetail.noCredits')} />
                    </div>

                    <Separator />

                    {/* Edit mode toggle */}
                    {!isEditingCredits ? (
                      <Button
                        variant="outline"
                        onClick={handleStartEdit}
                      >
                        {t('admin.userDetail.adjustCredits')}
                      </Button>
                    ) : (
                      <div className="space-y-4">
                        {/* Mode selector */}
                        <div className="flex gap-2">
                          <Button
                            variant={adjustmentMode === 'set' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handleModeChange('set')}
                          >
                            {t('admin.userDetail.setBalance')}
                          </Button>
                          <Button
                            variant={adjustmentMode === 'adjust' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handleModeChange('adjust')}
                          >
                            {t('admin.userDetail.adjustBalance')}
                          </Button>
                        </div>

                        <Label className="text-sm font-medium">
                          {adjustmentMode === 'set'
                            ? t('admin.userDetail.setBalanceLabel')
                            : t('admin.userDetail.creditAdjustments')}:
                        </Label>

                        {isSaving && (
                          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
                            <span className="animate-pulse">*</span>
                            {t('admin.userDetail.creditsSaving')}
                          </div>
                        )}

                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label htmlFor="basic-value" className="text-xs text-muted-foreground">
                              Basic {adjustmentMode === 'adjust' && '(+/-)'}
                            </Label>
                            <Input
                              id="basic-value"
                              type="number"
                              min={adjustmentMode === 'set' ? 0 : undefined}
                              value={basicValue}
                              onChange={(e) => setBasicValue(parseInt(e.target.value) || 0)}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor="pro-value" className="text-xs text-muted-foreground">
                              Pro {adjustmentMode === 'adjust' && '(+/-)'}
                            </Label>
                            <Input
                              id="pro-value"
                              type="number"
                              min={adjustmentMode === 'set' ? 0 : undefined}
                              value={proValue}
                              onChange={(e) => setProValue(parseInt(e.target.value) || 0)}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor="cassandra-value" className="text-xs text-muted-foreground">
                              Cassandra {adjustmentMode === 'adjust' && '(+/-)'}
                            </Label>
                            <Input
                              id="cassandra-value"
                              type="number"
                              min={adjustmentMode === 'set' ? 0 : undefined}
                              value={cassandraValue}
                              onChange={(e) => setCassandraValue(parseInt(e.target.value) || 0)}
                              className="mt-1"
                            />
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="reason" className="text-xs text-muted-foreground">
                            {t('admin.userDetail.reason')}
                          </Label>
                          <Input
                            id="reason"
                            type="text"
                            placeholder={t('admin.userDetail.reasonPlaceholder')}
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
                            {isSaving ? t('admin.common.saving') : t('admin.common.save')}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={handleCancelEdit}
                            disabled={isSaving}
                          >
                            {t('admin.common.cancel')}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Admin Actions Card */}
            <Card>
              <CardHeader>
                <CardTitle>{t('admin.userDetail.adminActions')}</CardTitle>
                <CardDescription>{t('admin.userDetail.adminActionsDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Admin Grant/Revoke Button - only for users with email */}
                  {userData?.email && !adminStatusLoading && (
                    <AlertDialog
                      open={adminDialogOpen}
                      onOpenChange={(open) => {
                        if (!isAdminToggleProcessing) setAdminDialogOpen(open);
                      }}
                    >
                      <AlertDialogTrigger asChild>
                        <Button
                          variant={isUserAdmin ? 'destructive' : 'default'}
                          className="w-full justify-start gap-2"
                          disabled={isLoading || isAdminToggleProcessing}
                        >
                          {isUserAdmin ? (
                            <>
                              <ShieldOff className="h-4 w-4" />
                              {t('admin.users.actions.revokeAdmin')}
                            </>
                          ) : (
                            <>
                              <Shield className="h-4 w-4" />
                              {t('admin.users.actions.grantAdmin')}
                            </>
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {isUserAdmin
                              ? t('admin.users.confirmRevokeAdmin.title')
                              : t('admin.users.confirmGrantAdmin.title')}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {isUserAdmin
                              ? t('admin.users.confirmRevokeAdmin.description')
                              : t('admin.users.confirmGrantAdmin.description')}
                            <br />
                            <span className="font-medium">{userData.email}</span>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t('admin.common.cancel')}</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleAdminToggle}
                            disabled={isAdminToggleProcessing}
                            className={isUserAdmin ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
                          >
                            {isAdminToggleProcessing
                              ? t('admin.common.processing')
                              : isUserAdmin
                                ? t('admin.users.confirmRevokeAdmin.confirm')
                                : t('admin.users.confirmGrantAdmin.confirm')}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}

                  {userData?.email && !adminStatusLoading && <Separator />}

                  {/* Ban/Unban Button with Confirmation */}
                  <AlertDialog
                    open={banDialogOpen}
                    onOpenChange={(open) => {
                      if (!isBanProcessing) setBanDialogOpen(open);
                    }}
                  >
                    <AlertDialogTrigger asChild>
                      <Button
                        variant={userData?.is_banned ? 'outline' : 'secondary'}
                        className="w-full justify-start gap-2"
                        disabled={isLoading || isBanProcessing}
                      >
                        {userData?.is_banned ? (
                          <>
                            <ShieldOff className="h-4 w-4" />
                            {t('admin.users.actions.unban')}
                          </>
                        ) : (
                          <>
                            <Ban className="h-4 w-4" />
                            {t('admin.users.actions.ban')}
                          </>
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {userData?.is_banned
                            ? t('admin.users.confirmUnban.title')
                            : t('admin.users.confirmBan.title')}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {userData?.is_banned
                            ? t('admin.users.confirmUnban.description')
                            : t('admin.users.confirmBan.description')}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('admin.common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleToggleBan}
                          disabled={isBanProcessing}
                        >
                          {isBanProcessing
                            ? t('admin.common.processing')
                            : userData?.is_banned
                              ? t('admin.users.confirmUnban.confirm')
                              : t('admin.users.confirmBan.confirm')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <Separator />

                  {/* Delete Button with Confirmation */}
                  <AlertDialog
                    open={deleteDialogOpen}
                    onOpenChange={(open) => {
                      if (!isDeleteProcessing) setDeleteDialogOpen(open);
                    }}
                  >
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        className="w-full justify-start gap-2"
                        disabled={isLoading || isDeleteProcessing}
                      >
                        <Trash2 className="h-4 w-4" />
                        {t('admin.users.actions.delete')}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('admin.users.confirmDelete.title')}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t('admin.users.confirmDelete.description')}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('admin.common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteUser}
                          disabled={isDeleteProcessing}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {isDeleteProcessing
                            ? t('admin.common.processing')
                            : t('admin.users.confirmDelete.confirm')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right column: Recent Activity */}
          <div className="space-y-6">
            {/* Recent Messages Card */}
            <Card>
              <CardHeader>
                <CardTitle>{t('admin.userDetail.recentMessages')}</CardTitle>
                <CardDescription>{t('admin.userDetail.last10Messages')}</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <ListSkeleton items={5} />
                ) : messages.length === 0 ? (
                  <div className="text-muted-foreground text-center py-8">
                    {t('admin.userDetail.noMessages')}
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
                <CardTitle>{t('admin.userDetail.recentAnalyses')}</CardTitle>
                <CardDescription>{t('admin.userDetail.last5Readings')}</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <ListSkeleton items={3} />
                ) : analyses.length === 0 ? (
                  <div className="text-muted-foreground text-center py-8">
                    {t('admin.userDetail.noAnalyses')}
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
