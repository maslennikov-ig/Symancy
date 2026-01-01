/**
 * Telegram WebApp Hook
 *
 * Provides access to Telegram WebApp API for Mini Apps.
 * Reads initData, handles theming, and provides WebApp utilities.
 *
 * @module hooks/useTelegramWebApp
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ThemeParams,
  SafeAreaInset,
  bindTelegramTheme,
  bindSafeAreaToCss,
  bindViewportToCss,
} from '../utils/telegramTheme';

// Re-export types for consumers
export type { ThemeParams, SafeAreaInset };

/**
 * Telegram WebApp user data structure
 */
export interface TelegramWebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

/**
 * Telegram WebApp object type (minimal subset we use)
 */
export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    query_id?: string;
    user?: TelegramWebAppUser;
    auth_date?: number;
    hash?: string;
    start_param?: string;
    chat_type?: string;
    chat_instance?: string;
  };
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: ThemeParams;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  isClosingConfirmationEnabled: boolean;
  // Safe area support (Bot API 8.0+)
  safeAreaInset?: SafeAreaInset;
  contentSafeAreaInset?: SafeAreaInset;
  isFullscreen?: boolean;
  ready: () => void;
  expand: () => void;
  close: () => void;
  enableClosingConfirmation: () => void;
  disableClosingConfirmation: () => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  // Fullscreen methods (Bot API 8.0+)
  requestFullscreen?: () => void;
  exitFullscreen?: () => void;
  showPopup: (params: {
    title?: string;
    message: string;
    buttons?: Array<{
      id?: string;
      type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive';
      text?: string;
    }>;
  }, callback?: (buttonId: string) => void) => void;
  showAlert: (message: string, callback?: () => void) => void;
  showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void;
  // Event system
  onEvent?: (eventType: string, callback: () => void) => void;
  offEvent?: (eventType: string, callback: () => void) => void;
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    isProgressVisible: boolean;
    setText: (text: string) => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    showProgress: (leaveActive?: boolean) => void;
    hideProgress: () => void;
  };
  BackButton: {
    isVisible: boolean;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    show: () => void;
    hide: () => void;
  };
  // CloudStorage API (Bot API 6.9+)
  CloudStorage?: {
    getItem: (
      key: string,
      callback: (error: Error | null, value: string | null) => void
    ) => void;
    getItems: (
      keys: string[],
      callback: (error: Error | null, values: Record<string, string>) => void
    ) => void;
    setItem: (
      key: string,
      value: string,
      callback?: (error: Error | null, success: boolean) => void
    ) => void;
    removeItem: (
      key: string,
      callback?: (error: Error | null, success: boolean) => void
    ) => void;
    removeItems: (
      keys: string[],
      callback?: (error: Error | null, success: boolean) => void
    ) => void;
    getKeys: (
      callback: (error: Error | null, keys: string[]) => void
    ) => void;
  };
  // Write Access API (Bot API 6.9+) - Request permission to send messages
  requestWriteAccess?: (callback: (granted: boolean) => void) => void;
}

/**
 * Extended window interface with Telegram
 */
declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

/**
 * Hook return type
 */
export interface UseTelegramWebAppReturn {
  /** Whether running inside Telegram WebApp */
  isWebApp: boolean;
  /** Whether WebApp is ready (script loaded and initialized) */
  isReady: boolean;
  /**
   * Raw initData string for server verification
   * WARNING: MUST be validated on your backend before trusting!
   * @see https://docs.telegram-mini-apps.com/platform/authorizing-user
   */
  initData: string | null;
  /**
   * Parsed user data - FOR DISPLAY ONLY
   * WARNING: DO NOT trust without server-side validation!
   */
  user: TelegramWebAppUser | null;
  /** Color scheme from Telegram */
  colorScheme: 'light' | 'dark';
  /** Theme parameters from Telegram */
  themeParams: ThemeParams;
  /** WebApp version */
  version: string | null;
  /** Platform (android, ios, web, etc.) */
  platform: string | null;
  /** Start parameter from WebApp link */
  startParam: string | null;
  /**
   * Stable viewport height - excludes keyboard (use for main layout)
   * MEDIUM-BUG-4 FIX: Renamed for clarity
   */
  viewportStableHeight: number;
  /**
   * Dynamic viewport height - includes keyboard changes
   * @deprecated Use viewportStableHeight for layout, this is for special cases only
   */
  viewportHeight: number;
  /** Expand the WebApp to full height */
  expand: () => void;
  /** Close the WebApp */
  close: () => void;
  /** Show a popup */
  showPopup: (params: {
    title?: string;
    message: string;
    buttons?: Array<{
      id?: string;
      type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive';
      text?: string;
    }>;
  }) => Promise<string>;
  /** Show an alert */
  showAlert: (message: string) => Promise<void>;
  /** Show a confirm dialog */
  showConfirm: (message: string) => Promise<boolean>;
  /** Trigger haptic feedback */
  hapticFeedback: {
    impact: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notification: (type: 'error' | 'success' | 'warning') => void;
    selection: () => void;
  };
  /** Access to raw WebApp object (use with caution) */
  webApp: TelegramWebApp | null;
}

/**
 * Hook for Telegram WebApp integration
 *
 * Provides access to Telegram WebApp API including:
 * - initData for server-side authentication
 * - User information (unverified, for display)
 * - Theme synchronization
 * - WebApp controls (expand, close, haptic feedback)
 *
 * @returns WebApp state and utilities
 *
 * @example
 * ```tsx
 * function App() {
 *   const { isWebApp, initData, user, colorScheme } = useTelegramWebApp();
 *
 *   if (isWebApp && initData) {
 *     // Authenticate with backend
 *     authService.webAppLogin(initData);
 *   }
 *
 *   return <div>Hello, {user?.first_name || 'Guest'}</div>;
 * }
 * ```
 */
// MEDIUM-QUALITY-1 FIX: Removed duplicate bindThemeToCss and bindSafeAreaToCss
// Now using shared utilities from '../utils/telegramTheme'

export function useTelegramWebApp(): UseTelegramWebAppReturn {
  const [isReady, setIsReady] = useState(false);
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);
  // MEDIUM-BUG-4 FIX: Track both viewport heights
  const [viewportStableHeight, setViewportStableHeight] = useState(0);
  const [viewportDynamicHeight, setViewportDynamicHeight] = useState(0);

  // HIGH-1 FIX: Track previous theme for efficient CSS updates
  const previousThemeRef = useRef<ThemeParams>({});

  // Initialize WebApp on mount
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg) return;

    // CRITICAL-1 FIX: Capture snapshot for stable closure references
    const webAppSnapshot = tg;

    // Add tg-webapp class to HTML element for CSS targeting
    document.documentElement.classList.add('tg-webapp');

    // Signal to Telegram that the WebApp is ready
    tg.ready();

    // Expand to full height for better UX
    if (!tg.isExpanded) {
      tg.expand();
    }

    // HIGH-1 FIX: Bind ThemeParams with previous value comparison
    // MEDIUM-QUALITY-1 FIX: Using shared utility
    previousThemeRef.current = bindTelegramTheme(
      tg.themeParams,
      previousThemeRef.current
    );

    // Bind safe area insets to CSS variables (using shared utility)
    bindSafeAreaToCss(tg.safeAreaInset);

    // CRITICAL-1 & CRITICAL-2 FIX: Stable function references created ONCE
    const handleThemeChanged = () => {
      // HIGH-1 FIX: Only update changed CSS variables
      // MEDIUM-QUALITY-1 FIX: Using shared utility
      previousThemeRef.current = bindTelegramTheme(
        webAppSnapshot.themeParams,
        previousThemeRef.current
      );

      // CRITICAL-2 FIX: Use functional update with JSON comparison
      // to avoid unnecessary re-renders
      setWebApp((prev) => {
        if (!prev) return webAppSnapshot;
        // Only update if theme actually changed
        if (
          JSON.stringify(prev.themeParams) ===
          JSON.stringify(webAppSnapshot.themeParams)
        ) {
          return prev; // Preserve reference equality
        }
        return { ...webAppSnapshot };
      });
    };

    // Listen for safe area changes
    const handleSafeAreaChanged = () => {
      bindSafeAreaToCss(webAppSnapshot.safeAreaInset);
    };

    // MEDIUM-BUG-4 FIX: Listen for viewport changes - track both heights
    const handleViewportChanged = () => {
      setViewportStableHeight(webAppSnapshot.viewportStableHeight);
      setViewportDynamicHeight(webAppSnapshot.viewportHeight);
      // Also update CSS variables
      bindViewportToCss(webAppSnapshot.viewportHeight, webAppSnapshot.viewportStableHeight);
    };

    // HIGH-BUG-2 FIX: Store listener references to ensure proper cleanup
    const listeners: Array<{ event: string; handler: () => void }> = [];

    const addEventListenerSafe = (event: string, handler: () => void) => {
      if (typeof tg.onEvent === 'function') {
        tg.onEvent(event, handler);
        listeners.push({ event, handler });
      }
    };

    addEventListenerSafe('themeChanged', handleThemeChanged);
    addEventListenerSafe('safeAreaChanged', handleSafeAreaChanged);
    addEventListenerSafe('viewportChanged', handleViewportChanged);

    // MEDIUM-BUG-4 FIX: Set initial viewport heights (both)
    setViewportStableHeight(tg.viewportStableHeight);
    setViewportDynamicHeight(tg.viewportHeight);
    setWebApp(webAppSnapshot);
    setIsReady(true);

    // CRITICAL-1 FIX: Cleanup with stored listener references
    return () => {
      // Remove tg-webapp class on cleanup
      document.documentElement.classList.remove('tg-webapp');

      // HIGH-BUG-2 FIX: Only remove listeners that were actually added
      if (typeof tg.offEvent === 'function') {
        listeners.forEach(({ event, handler }) => {
          tg.offEvent!(event, handler);
        });
      }
    };
  }, []); // Empty deps - run once only

  // MED-1 FIX: Remove useMemo for simple property access
  // Simple property access - no need for useMemo overhead
  const isWebApp = !!webApp;
  const initData = webApp?.initData || null;
  const user = webApp?.initDataUnsafe?.user || null;
  const startParam = webApp?.initDataUnsafe?.start_param || null;
  const colorScheme = webApp?.colorScheme || 'light';
  const themeParams = webApp?.themeParams || {};
  const version = webApp?.version || null;
  const platform = webApp?.platform || null;

  // WebApp controls
  const expand = useCallback(() => {
    webApp?.expand();
  }, [webApp]);

  const close = useCallback(() => {
    webApp?.close();
  }, [webApp]);

  // M3 FIX: Popup functions with Promise wrappers and SSR/testing safety
  const showPopup = useCallback((params: {
    title?: string;
    message: string;
    buttons?: Array<{
      id?: string;
      type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive';
      text?: string;
    }>;
  }): Promise<string> => {
    return new Promise((resolve) => {
      if (webApp) {
        webApp.showPopup(params, (buttonId) => {
          resolve(buttonId);
        });
      } else if (typeof window !== 'undefined' && window.alert) {
        // M3 FIX: Safe fallback for browser environment
        try {
          window.alert(params.message);
          resolve('ok');
        } catch (error) {
          console.error('Popup fallback failed:', error);
          resolve('ok');
        }
      } else {
        // M3 FIX: Graceful fallback for SSR/testing
        console.warn('Popup not available:', params.message);
        resolve('ok');
      }
    });
  }, [webApp]);

  const showAlert = useCallback((message: string): Promise<void> => {
    return new Promise((resolve) => {
      if (webApp) {
        webApp.showAlert(message, () => {
          resolve();
        });
      } else if (typeof window !== 'undefined' && window.alert) {
        // M3 FIX: Safe fallback for browser environment
        try {
          window.alert(message);
          resolve();
        } catch (error) {
          console.error('Alert fallback failed:', error);
          resolve();
        }
      } else {
        // M3 FIX: Graceful fallback for SSR/testing
        console.warn('Alert not available:', message);
        resolve();
      }
    });
  }, [webApp]);

  const showConfirm = useCallback((message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      if (webApp) {
        webApp.showConfirm(message, (confirmed) => {
          resolve(confirmed);
        });
      } else if (typeof window !== 'undefined' && window.confirm) {
        // M3 FIX: Safe fallback for browser environment
        try {
          resolve(window.confirm(message));
        } catch (error) {
          console.error('Confirm fallback failed:', error);
          resolve(false);
        }
      } else {
        // M3 FIX: Graceful fallback for SSR/testing (default to false for safety)
        console.warn('Confirm not available:', message);
        resolve(false);
      }
    });
  }, [webApp]);

  // Haptic feedback with Web Vibration API fallback
  const hapticFeedback = useMemo(() => ({
    impact: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => {
      if (webApp?.HapticFeedback?.impactOccurred) {
        webApp.HapticFeedback.impactOccurred(style);
      } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        // Fallback to Web Vibration API
        const durations: Record<typeof style, number> = {
          light: 10,
          medium: 20,
          heavy: 30,
          rigid: 15,
          soft: 25
        };
        try {
          navigator.vibrate(durations[style] || 20);
        } catch {
          // Vibration API not supported or blocked
        }
      }
    },
    notification: (type: 'error' | 'success' | 'warning') => {
      if (webApp?.HapticFeedback?.notificationOccurred) {
        webApp.HapticFeedback.notificationOccurred(type);
      } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        // Fallback to Web Vibration API with patterns
        const patterns: Record<typeof type, number | number[]> = {
          error: [50, 50, 50],
          success: [30],
          warning: [30, 30]
        };
        try {
          navigator.vibrate(patterns[type] || [30]);
        } catch {
          // Vibration API not supported or blocked
        }
      }
    },
    selection: () => {
      if (webApp?.HapticFeedback?.selectionChanged) {
        webApp.HapticFeedback.selectionChanged();
      } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        // Short vibration for selection feedback
        try {
          navigator.vibrate(5);
        } catch {
          // Vibration API not supported or blocked
        }
      }
    },
  }), [webApp]);

  return {
    isWebApp,
    isReady,
    initData,
    user,
    colorScheme,
    themeParams,
    version,
    platform,
    startParam,
    // MEDIUM-BUG-4 FIX: Export both viewport heights with clear naming
    viewportStableHeight,
    viewportHeight: viewportDynamicHeight, // For backward compatibility
    expand,
    close,
    showPopup,
    showAlert,
    showConfirm,
    hapticFeedback,
    webApp,
  };
}

/**
 * Check if running inside Telegram WebApp (synchronous, for guards)
 *
 * @returns True if Telegram.WebApp is available with initData
 */
export function isTelegramWebApp(): boolean {
  return !!window.Telegram?.WebApp;
}
