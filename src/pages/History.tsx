/**
 * History Page - Analysis History for Telegram Mini App
 *
 * Page wrapper for HistoryDisplay component, optimized for Telegram Mini App layout.
 * Displays past coffee cup analyses and allows viewing/revisiting them.
 *
 * Layout:
 * 1. Header with page title
 * 2. HistoryDisplay component (scrollable list)
 * 3. Bottom padding for BottomNav (80px + safe area)
 *
 * @module pages/History
 */
import React, { useState, Suspense, lazy, useEffect } from 'react';
import { useLocation } from 'react-router';
import { translations, Lang, t as i18n_t } from '../lib/i18n';
import { useAuth } from '../contexts/AuthContext';
import { LoaderIcon } from '../components/icons/LoaderIcon';
import { HistoryItem } from '../services/historyService';

// Lazy load HistoryDisplay for code splitting
const HistoryDisplay = lazy(
  () => import('../components/features/history/HistoryDisplay')
);

interface HistoryProps {
  /** Current language */
  language: Lang;
  /** Translation function */
  t: (key: keyof typeof translations.en) => string;
}

/**
 * History - Analysis history page for Telegram Mini App
 */
const History: React.FC<HistoryProps> = ({ language: propLanguage, t: propT }) => {
  const location = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();

  // Use props or fallback to defaults
  const language = propLanguage || 'ru';
  const t = propT || ((key: keyof typeof translations.en) => i18n_t(key, language));

  // State for initial expanded item from RecentActivity
  const [initialExpandedId, setInitialExpandedId] = useState<string | null>(() => {
    return (location.state as any)?.selectedAnalysis?.id || null;
  });

  // Sync state if location state changes while mounted
  useEffect(() => {
    if ((location.state as any)?.selectedAnalysis?.id) {
      setInitialExpandedId((location.state as any).selectedAnalysis.id);
    }
  }, [location.state]);

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

  // Main history list view (accordion)
  return (
    <div
      className="bg-background"
      style={{
        minHeight: '100%',
        paddingTop: 'var(--tg-content-safe-area-inset-top, 0px)',
      }}
    >
      {/* Header */}
      <header className="px-4 pt-4 pb-4">
        <h1 className="text-xl font-bold text-foreground">
          {t('history.title')}
        </h1>
      </header>

      {/* Main content */}
      <main className="px-4 pb-24">
        {!isAuthenticated ? (
          // Show login prompt for unauthenticated users
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📋</div>
            <h2 className="text-lg font-semibold text-foreground mb-2">
              {t('history.empty.title')}
            </h2>
            <p className="text-muted-foreground">
              {t('history.empty.subtitle')}
            </p>
          </div>
        ) : (
          <Suspense
            fallback={
              <div className="flex items-center justify-center p-8">
                <LoaderIcon className="w-8 h-8 animate-spin text-primary" />
              </div>
            }
          >
            <HistoryDisplay
              t={t as (key: string) => string}
              language={language}
              initialExpandedId={initialExpandedId}
            />
          </Suspense>
        )}
      </main>
    </div>
  );
};

export default History;
