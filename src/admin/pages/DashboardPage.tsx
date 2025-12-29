import React, { useState, useEffect } from 'react';
import { Card, Metric, Text, Grid, Title, Badge, Flex } from '@tremor/react';
import { Settings, Users, MessageSquare, DollarSign, Activity, BarChart3, TrendingUp } from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { AdminLayout } from '../layout/AdminLayout';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { supabase } from '../../lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { formatCurrencyRUB, formatNumber } from '../utils/formatters';
import { logger } from '../utils/logger';
import { StatCardSkeleton } from '../components/skeletons';

interface DashboardStats {
  totalUsers: number;
  totalAnalyses: number;
  activeToday: number;
  totalRevenue: number;
  isLoading: boolean;
  error: string | null;
}

interface QuickLinkProps {
  to: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}

function QuickLink({ to, icon, title, description }: QuickLinkProps) {
  return (
    <Link
      to={to}
      className="flex items-center gap-4 p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
        {icon}
      </div>
      <div>
        <h3 className="font-medium text-slate-900 dark:text-slate-100">{title}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
      </div>
    </Link>
  );
}

/**
 * Admin Dashboard Page
 * Shows key statistics and quick navigation links
 */
export function DashboardPage() {
  const { user, signOut } = useAdminAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalAnalyses: 0,
    activeToday: 0,
    totalRevenue: 0,
    isLoading: true,
    error: null,
  });
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchStats() {
      setStats(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        // Fetch all stats in parallel
        const [usersResult, analysesResult, activeTodayResult, revenueResult] = await Promise.all([
          // Total users from unified_users
          supabase.from('unified_users').select('id', { count: 'exact', head: true }),

          // Total analyses from analysis_history
          supabase.from('analysis_history').select('id', { count: 'exact', head: true }),

          // Active today - users with last_active_at today
          supabase
            .from('unified_users')
            .select('id', { count: 'exact', head: true })
            .gte('last_active_at', new Date().toISOString().split('T')[0]),

          // Total revenue - sum of amount_rub where status='succeeded'
          supabase
            .from('purchases')
            .select('amount_rub')
            .eq('status', 'succeeded'),
        ]);

        // Calculate total revenue from successful purchases
        const totalRevenue = revenueResult.data?.reduce(
          (sum, purchase) => sum + (purchase.amount_rub || 0),
          0
        ) ?? 0;

        if (!cancelled) {
          setStats({
            totalUsers: usersResult.count ?? 0,
            totalAnalyses: analysesResult.count ?? 0,
            activeToday: activeTodayResult.count ?? 0,
            totalRevenue,
            isLoading: false,
            error: null,
          });
        }
      } catch (error) {
        logger.error('Failed to fetch dashboard stats', error);
        const message = error instanceof Error ? error.message : 'Failed to load statistics';
        if (!cancelled) {
          setStats(prev => ({
            ...prev,
            isLoading: false,
            error: message,
          }));
          toast.error('Failed to load statistics', { description: message });
        }
      }
    }

    fetchStats();

    return () => {
      cancelled = true;
    };
  }, [refreshTrigger]);

  const handleRetry = () => setRefreshTrigger(prev => prev + 1);

  return (
    <AdminLayout
      title="Dashboard"
      userName={user?.user_metadata?.full_name ?? user?.email?.split('@')[0]}
      userEmail={user?.email}
      userAvatar={user?.user_metadata?.avatar_url}
      onLogout={signOut}
    >
      {/* Stats Grid */}
      <div className="mb-8">
        <Title className="mb-4">Overview</Title>

        {stats.error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center justify-between gap-4">
            <p className="text-red-700 dark:text-red-400">{stats.error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              disabled={stats.isLoading}
            >
              Retry
            </Button>
          </div>
        )}

        <Grid numItemsMd={2} numItemsLg={4} className="gap-4">
          {stats.isLoading ? (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          ) : (
            <>
              <Card decoration="top" decorationColor="blue">
                <Flex justifyContent="between" alignItems="center">
                  <div>
                    <Text>Total Users</Text>
                    <Metric>{formatNumber(stats.totalUsers)}</Metric>
                  </div>
                  <Users className="h-8 w-8 text-blue-500" />
                </Flex>
              </Card>

              <Card decoration="top" decorationColor="violet">
                <Flex justifyContent="between" alignItems="center">
                  <div>
                    <Text>Total Analyses</Text>
                    <Metric>{formatNumber(stats.totalAnalyses)}</Metric>
                  </div>
                  <BarChart3 className="h-8 w-8 text-violet-500" />
                </Flex>
              </Card>

              <Card decoration="top" decorationColor="emerald">
                <Flex justifyContent="between" alignItems="center">
                  <div>
                    <Text>Active Today</Text>
                    <Metric>{formatNumber(stats.activeToday)}</Metric>
                  </div>
                  <Badge color="emerald" size="sm">
                    <Activity className="h-3 w-3 mr-1" />
                    Live
                  </Badge>
                </Flex>
              </Card>

              <Card decoration="top" decorationColor="amber">
                <Flex justifyContent="between" alignItems="center">
                  <div>
                    <Text>Total Revenue</Text>
                    <Metric>{formatCurrencyRUB(stats.totalRevenue)}</Metric>
                  </div>
                  <TrendingUp className="h-8 w-8 text-amber-500" />
                </Flex>
              </Card>
            </>
          )}
        </Grid>
      </div>

      {/* Quick Links */}
      <div>
        <Title className="mb-4">Quick Links</Title>
        <Grid numItemsMd={2} numItemsLg={4} className="gap-4">
          <QuickLink
            to="/admin/system-config"
            icon={<Settings className="h-5 w-5" />}
            title="System Config"
            description="Manage system settings"
          />
          <QuickLink
            to="/admin/users"
            icon={<Users className="h-5 w-5" />}
            title="Users"
            description="View and manage users"
          />
          <QuickLink
            to="/admin/messages"
            icon={<MessageSquare className="h-5 w-5" />}
            title="Messages"
            description="View message history"
          />
          <QuickLink
            to="/admin/costs"
            icon={<DollarSign className="h-5 w-5" />}
            title="Costs"
            description="Monitor API costs"
          />
        </Grid>
      </div>
    </AdminLayout>
  );
}

export default DashboardPage;
