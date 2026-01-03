/**
 * Home Dashboard Page
 *
 * Main landing page for Telegram Mini App users.
 * Displays credit balance, daily insight, quick actions, and recent activity.
 *
 * Layout:
 * 1. Header with app title
 * 2. Balance Card (credits summary)
 * 3. Daily Insight Card (teaser)
 * 4. Quick Actions (2 buttons: New Analysis, Start Chat)
 * 5. Recent Activity Card (last analysis or message)
 * Bottom padding for BottomNav (80px)
 *
 * @module pages/Home
 */
import React from 'react';
import { translations, Lang, t as i18n_t } from '../lib/i18n';
import { useAuth } from '../contexts/AuthContext';
import { useCloudStorage } from '../hooks/useCloudStorage';
import { useTelegramWebApp } from '../hooks/useTelegramWebApp';
import { BalanceCard } from '../components/features/home/BalanceCard';
import { DailyInsightCard } from '../components/features/home/DailyInsightCard';
import { QuickActions } from '../components/features/home/QuickActions';
import { RecentActivity } from '../components/features/home/RecentActivity';
import { LoaderIcon } from '../components/icons/LoaderIcon';

interface HomeProps {
  /** Current language */
  language: Lang;
  /** Translation function */
  t: (key: keyof typeof translations.en) => string;
}

/**
 * Home - Main dashboard page for Telegram Mini App
 */
const Home: React.FC<HomeProps> = ({ language: propLanguage, t: propT }) => {
  const { isAuthenticated, loading: authLoading, unifiedUser, user } = useAuth();
  const { dailyInsightCache, isLoading: prefsLoading } = useCloudStorage();
  const { isWebApp } = useTelegramWebApp();

  const language = propLanguage || 'ru';
  const t = propT || ((key: keyof typeof translations.en) => i18n_t(key, language));

  // Get user display name (UnifiedUser only has display_name, not username)
  const userName = unifiedUser?.display_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    null;

  // Show loading while auth is initializing
  if (authLoading) {
    return (
      <div
        className="flex items-center justify-center min-h-screen bg-background"
        style={{
          paddingTop: 'var(--tg-content-safe-area-inset-top, 0px)',
        }}
      >
        <LoaderIcon className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div
      className="bg-background"
      style={{
        minHeight: '100%',
      }}
    >
      {/* Header */}
      <header className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-bold text-foreground">
          {t('home.title')}
        </h1>
        {userName && (
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('greeting.hello')}, {userName}
          </p>
        )}
      </header>

      {/* Main content */}
      <main className="px-4 space-y-4">
        {/* Balance Card */}
        {isAuthenticated && (
          <BalanceCard
            t={t as (key: string) => string}
          />
        )}

        {/* Daily Insight Card */}
        <DailyInsightCard
          t={t as (key: string) => string}
          language={language}
          dailyInsightCache={dailyInsightCache}
        />

        {/* Quick Actions */}
        <QuickActions
          t={t as (key: string) => string}
        />

        {/* Recent Activity */}
        <RecentActivity
          t={t as (key: string) => string}
        />
      </main>
    </div>
  );
};

export default Home;
