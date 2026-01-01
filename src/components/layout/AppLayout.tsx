/**
 * AppLayout - Wrapper component for Telegram Mini App layout
 *
 * Provides consistent layout with:
 * - Safe area padding for Telegram Mini App
 * - Optional BottomNav for main app routes
 * - Bottom padding when BottomNav is shown
 *
 * @module components/layout/AppLayout
 */
import React from 'react';
import { useTelegramWebApp } from '../../hooks/useTelegramWebApp';
import { BottomNav } from './BottomNav';
import { translations, Lang } from '../../lib/i18n';
import { BOTTOM_NAV_HEIGHT } from '../../constants/layout';

/**
 * Props for AppLayout component
 */
export interface AppLayoutProps {
  /** Page content */
  children: React.ReactNode;
  /** Current language */
  language: Lang;
  /** Translation function */
  t: (key: keyof typeof translations.en) => string;
  /** Whether to show bottom navigation (defaults to true for Telegram users) */
  showBottomNav?: boolean;
}

/**
 * AppLayout - Common layout wrapper for Telegram Mini App pages
 *
 * Features:
 * - Automatic BottomNav display for Telegram Mini App users
 * - Safe area insets handling
 * - Proper bottom padding to prevent content overlap with BottomNav
 *
 * @example
 * ```tsx
 * <AppLayout language={language} t={t}>
 *   <PageContent />
 * </AppLayout>
 * ```
 *
 * @example With BottomNav disabled
 * ```tsx
 * <AppLayout language={language} t={t} showBottomNav={false}>
 *   <FullScreenContent />
 * </AppLayout>
 * ```
 */
export function AppLayout({
  children,
  language,
  t,
  showBottomNav = true,
}: AppLayoutProps): React.ReactElement {
  const { isWebApp } = useTelegramWebApp();

  // Determine if BottomNav should be shown
  // Only show for Telegram Mini App users when enabled
  const shouldShowBottomNav = isWebApp && showBottomNav;

  return (
    <div
      className="app-layout"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        // Safe area padding for Telegram Mini App
        // Use contentSafeAreaInset for scrollable content areas (not safeAreaInset which is for fixed chrome)
        paddingTop: 'var(--tg-content-safe-area-inset-top, 0px)',
        // Bottom padding when BottomNav is visible
        paddingBottom: shouldShowBottomNav
          ? `calc(${BOTTOM_NAV_HEIGHT}px + var(--tg-content-safe-area-inset-bottom, 0px))`
          : 'var(--tg-content-safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Page content */}
      <div
        className="app-layout-content"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </div>

      {/* Bottom Navigation */}
      {shouldShowBottomNav && <BottomNav language={language} t={t} />}
    </div>
  );
}

export default AppLayout;
