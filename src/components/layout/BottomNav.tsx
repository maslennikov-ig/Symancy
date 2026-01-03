/**
 * BottomNav Component - Telegram Mini App Bottom Navigation
 *
 * A fixed bottom navigation bar for Telegram Mini App with 4 tabs:
 * Home, Chat, History, Profile
 *
 * Features:
 * - Active tab detection using react-router useLocation
 * - Haptic feedback on tab change (Telegram HapticFeedback API)
 * - Telegram theme integration with CSS variable fallbacks
 * - Safe area padding for devices with home indicators
 * - Badge support for future notifications
 * - Hidden on admin routes and in non-Telegram environment
 *
 * @module components/layout/BottomNav
 */
import React, { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useTelegramWebApp } from '../../hooks/useTelegramWebApp';
import { translations, Lang } from '../../lib/i18n';

/**
 * Navigation item definition
 */
interface NavItem {
  /** Unique identifier for the nav item */
  id: 'home' | 'chat' | 'history' | 'profile';
  /** Icon to display (emoji or React node) */
  icon: React.ReactNode;
  /** i18n key for the label */
  labelKey: keyof typeof translations.en;
  /** Route path */
  route: string;
  /** Optional badge count for notifications */
  badge?: number;
}

/**
 * Props for BottomNav component
 */
interface BottomNavProps {
  /** Current language */
  language: Lang;
  /** Translation function */
  t: (key: keyof typeof translations.en) => string;
  /** Optional additional CSS class */
  className?: string;
}

/**
 * Navigation items configuration
 */
const NAV_ITEMS: NavItem[] = [
  {
    id: 'home',
    icon: <HomeIcon />,
    labelKey: 'nav.home',
    route: '/',
  },
  {
    id: 'chat',
    icon: <ChatIcon />,
    labelKey: 'nav.chat',
    route: '/chat',
  },
  {
    id: 'history',
    icon: <HistoryIcon />,
    labelKey: 'nav.history',
    route: '/history',
  },
  {
    id: 'profile',
    icon: <ProfileIcon />,
    labelKey: 'nav.profile',
    route: '/profile',
  },
];

/**
 * Routes where BottomNav should be hidden
 */
const HIDDEN_ROUTES = ['/admin', '/payment', '/terms', '/contacts', '/pricing'];

/**
 * Check if current route matches nav item
 */
function isActiveRoute(currentPath: string, route: string): boolean {
  if (route === '/') {
    return currentPath === '/';
  }
  return currentPath.startsWith(route);
}

/**
 * Check if BottomNav should be hidden for current route
 */
function shouldHideNav(currentPath: string): boolean {
  return HIDDEN_ROUTES.some((route) => currentPath.startsWith(route));
}

/**
 * BottomNav - Fixed bottom navigation for Telegram Mini App
 *
 * @example
 * ```tsx
 * <BottomNav
 *   language={language}
 *   t={t}
 * />
 * ```
 */
export function BottomNav({ language, t, className }: BottomNavProps): React.ReactElement | null {
  const location = useLocation();
  const navigate = useNavigate();
  const { isWebApp, hapticFeedback } = useTelegramWebApp();

  // Handle tab click with haptic feedback
  const handleTabClick = useCallback(
    (item: NavItem) => {
      // Trigger haptic feedback for selection
      hapticFeedback.selection();

      // Navigate to the route
      navigate(item.route);
    },
    [hapticFeedback, navigate]
  );

  // Hide if not in Telegram WebApp
  if (!isWebApp) {
    return null;
  }

  // Hide on certain routes (admin, payment, etc.)
  if (shouldHideNav(location.pathname)) {
    return null;
  }

  return (
    <nav
      className={className}
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        // Telegram theme colors with fallbacks
        backgroundColor: 'var(--tg-theme-bg-color, hsl(var(--background)))',
        borderTop: '1px solid var(--tg-theme-hint-color, hsl(var(--border)))',
        // Safe area padding for devices with home indicators
        paddingBottom: 'var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 0px))',
        paddingTop: '4px',
        paddingLeft: '4px',
        paddingRight: '4px',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'flex-start',
        zIndex: 1000,
        // Subtle shadow for elevation
        boxShadow: '0 -1px 3px rgba(0, 0, 0, 0.1)',
      }}
      aria-label="Main navigation"
    >
      {NAV_ITEMS.map((item) => {
        const isActive = isActiveRoute(location.pathname, item.route);

        return (
          <button
            key={item.id}
            onClick={() => handleTabClick(item)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px 8px 6px',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              minWidth: '56px',
              position: 'relative',
              // Smooth transition for color changes
              transition: 'color 0.2s ease',
              // Active state styling
              color: isActive
                ? 'var(--tg-theme-button-color, hsl(var(--primary)))'
                : 'var(--tg-theme-hint-color, hsl(var(--muted-foreground)))',
            }}
            aria-current={isActive ? 'page' : undefined}
            aria-label={t(item.labelKey)}
          >
            {/* Icon container */}
            <span
              style={{
                fontSize: '20px',
                lineHeight: 1,
                marginBottom: '2px',
                opacity: isActive ? 1 : 0.7,
                transition: 'opacity 0.15s ease',
              }}
            >
              {item.icon}
            </span>

            {/* Label */}
            <span
              style={{
                fontSize: '10px',
                fontWeight: isActive ? 600 : 400,
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                transition: 'font-weight 0.15s ease',
              }}
            >
              {t(item.labelKey)}
            </span>

            {/* Badge (optional) */}
            {item.badge !== undefined && item.badge > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '0',
                  right: '8px',
                  backgroundColor: 'var(--tg-theme-destructive-text-color, hsl(var(--destructive)))',
                  color: '#fff',
                  fontSize: '10px',
                  fontWeight: 600,
                  minWidth: '16px',
                  height: '16px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                }}
              >
                {item.badge > 99 ? '99+' : item.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

// ============================================================================
// Icon Components - Simple SVG icons for better consistency than emojis
// ============================================================================

function HomeIcon(): React.ReactElement {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function ChatIcon(): React.ReactElement {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function HistoryIcon(): React.ReactElement {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function ProfileIcon(): React.ReactElement {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export default BottomNav;
