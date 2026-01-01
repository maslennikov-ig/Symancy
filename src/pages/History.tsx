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
 * Navigation:
 * - When selecting a history item, shows the analysis in a modal or navigates to detail view
 * - Back button returns to previous screen
 *
 * @module pages/History
 */
import React, { useState, useCallback, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router';
import { translations, Lang, t as i18n_t } from '../lib/i18n';
import { useAuth } from '../contexts/AuthContext';
import { useTelegramWebApp } from '../hooks/useTelegramWebApp';
import { LoaderIcon } from '../components/icons/LoaderIcon';
import { HistoryItem } from '../services/historyService';

// Lazy load HistoryDisplay for code splitting
const HistoryDisplay = lazy(
  () => import('../components/features/history/HistoryDisplay')
);

// Lazy load ResultDisplay for showing selected analysis
const ResultDisplay = lazy(
  () => import('../components/features/analysis/ResultDisplay')
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
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { isWebApp } = useTelegramWebApp();

  // Use props or fallback to defaults
  const language = propLanguage || 'ru';
  const t = propT || ((key: keyof typeof translations.en) => i18n_t(key, language));

  // State for selected analysis (when viewing a history item)
  const [selectedAnalysis, setSelectedAnalysis] = useState<HistoryItem | null>(null);

  // Detect theme from document
  const [theme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    }
    return 'light';
  });

  /**
   * Handle selecting a history item
   * Shows the analysis result in detail view
   */
  const handleSelectAnalysis = useCallback((item: HistoryItem) => {
    setSelectedAnalysis(item);
  }, []);

  /**
   * Handle closing the detail view
   * Returns to history list
   */
  const handleCloseDetail = useCallback(() => {
    setSelectedAnalysis(null);
  }, []);

  /**
   * Handle closing history (back navigation)
   * Navigate to home for Telegram Mini App, or go back
   */
  const handleClose = useCallback(() => {
    if (isWebApp) {
      // In Telegram Mini App, navigate to home
      navigate('/');
    } else {
      // On web, go back in history
      navigate(-1);
    }
  }, [navigate, isWebApp]);

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

  // If viewing a selected analysis, show ResultDisplay
  if (selectedAnalysis) {
    return (
      <div
        className="min-h-screen bg-background"
        style={{
          paddingTop: 'var(--tg-content-safe-area-inset-top, 0px)',
          paddingBottom: '100px', // Space for BottomNav + safe area
        }}
      >
        {/* Header with back button */}
        <header className="px-4 pt-4 pb-2 flex items-center gap-3">
          <button
            onClick={handleCloseDetail}
            className="p-2 -ml-2 rounded-full hover:bg-accent transition-colors"
            aria-label={t('history.back')}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-foreground"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-foreground">
            {t('history.viewAnalysis')}
          </h1>
        </header>

        {/* Analysis result */}
        <main className="px-4">
          <Suspense
            fallback={
              <div className="flex items-center justify-center p-8">
                <LoaderIcon className="w-8 h-8 animate-spin text-primary" />
              </div>
            }
          >
            <ResultDisplay
              analysis={selectedAnalysis.analysis}
              onReset={handleCloseDetail}
              theme={theme}
              t={t as (key: string) => string}
            />
          </Suspense>
        </main>
      </div>
    );
  }

  // Main history list view
  return (
    <div
      className="min-h-screen bg-background"
      style={{
        paddingTop: 'var(--tg-content-safe-area-inset-top, 0px)',
        paddingBottom: '100px', // Space for BottomNav + safe area
      }}
    >
      {/* Header */}
      <header className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-bold text-foreground">
          {t('history.title')}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t('header.subtitle')}
        </p>
      </header>

      {/* Main content */}
      <main className="px-4">
        {!isAuthenticated ? (
          // Show login prompt for unauthenticated users
          <div className="text-center py-12">
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
              onSelectAnalysis={handleSelectAnalysis}
              onClose={handleClose}
              t={t as (key: string) => string}
              language={language}
            />
          </Suspense>
        )}
      </main>
    </div>
  );
};

export default History;
