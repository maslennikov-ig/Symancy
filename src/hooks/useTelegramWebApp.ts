/**
 * Telegram WebApp Hook
 *
 * Provides access to Telegram WebApp API for Mini Apps.
 * Reads initData, handles theming, and provides WebApp utilities.
 *
 * @module hooks/useTelegramWebApp
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

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
 * Telegram WebApp theme parameters
 */
export interface ThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
  header_bg_color?: string;
  accent_text_color?: string;
  section_bg_color?: string;
  section_header_text_color?: string;
  subtitle_text_color?: string;
  destructive_text_color?: string;
  // Bot API 8.0 additions
  bottom_bar_bg_color?: string;
  section_separator_color?: string;
}

/**
 * Safe area inset type (Bot API 8.0+)
 */
export interface SafeAreaInset {
  top: number;
  bottom: number;
  left: number;
  right: number;
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
  /** Raw initData string for server verification */
  initData: string | null;
  /** Parsed user data (not verified, for display only) */
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
  /** Stable viewport height (updates on viewportChanged event) */
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
/**
 * Bind Telegram ThemeParams to CSS variables
 * Creates --tg-* CSS variables from Telegram's theme
 * Optimized: Only updates changed values to minimize DOM reflows
 *
 * @param themeParams - Theme parameters from Telegram WebApp
 * @param previousTheme - Previous theme params for comparison (optional)
 * @returns The current theme params for future comparison
 * @internal
 */
function bindThemeToCss(
  themeParams: ThemeParams,
  previousTheme?: ThemeParams
): ThemeParams {
  const root = document.documentElement;
  const prev = previousTheme || {};

  // Map of theme param keys to CSS variable names
  const themeMapping: Record<keyof ThemeParams, string> = {
    bg_color: '--tg-bg-color',
    text_color: '--tg-text-color',
    hint_color: '--tg-hint-color',
    link_color: '--tg-link-color',
    button_color: '--tg-button-color',
    button_text_color: '--tg-button-text-color',
    secondary_bg_color: '--tg-secondary-bg-color',
    header_bg_color: '--tg-header-bg-color',
    accent_text_color: '--tg-accent-text-color',
    section_bg_color: '--tg-section-bg-color',
    section_header_text_color: '--tg-section-header-text-color',
    subtitle_text_color: '--tg-subtitle-text-color',
    destructive_text_color: '--tg-destructive-text-color',
    bottom_bar_bg_color: '--tg-bottom-bar-bg-color',
    section_separator_color: '--tg-section-separator-color',
  };

  // Only update changed values to minimize DOM reflows
  (Object.keys(themeMapping) as Array<keyof ThemeParams>).forEach((key) => {
    const value = themeParams[key];
    const prevValue = prev[key];
    if (value && value !== prevValue) {
      root.style.setProperty(themeMapping[key], value);
    }
  });

  return { ...themeParams };
}

/**
 * Bind safe area insets to CSS variables
 * Creates --tg-safe-area-* CSS variables for iOS safe area handling
 *
 * @param safeAreaInset - Safe area inset from Telegram WebApp (Bot API 8.0+)
 * @internal
 */
function bindSafeAreaToCss(safeAreaInset: SafeAreaInset | undefined) {
  const root = document.documentElement;
  root.style.setProperty('--tg-safe-area-top', `${safeAreaInset?.top || 0}px`);
  root.style.setProperty('--tg-safe-area-bottom', `${safeAreaInset?.bottom || 0}px`);
  root.style.setProperty('--tg-safe-area-left', `${safeAreaInset?.left || 0}px`);
  root.style.setProperty('--tg-safe-area-right', `${safeAreaInset?.right || 0}px`);
}

export function useTelegramWebApp(): UseTelegramWebAppReturn {
  const [isReady, setIsReady] = useState(false);
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);
  // CRITICAL-3 FIX: Add state for viewport height
  const [viewportHeight, setViewportHeight] = useState(0);

  // HIGH-1 FIX: Track previous theme for efficient CSS updates
  const previousThemeRef = useRef<ThemeParams>({});

  // Initialize WebApp on mount
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg) return;

    // CRITICAL-1 FIX: Capture snapshot for stable closure references
    const webAppSnapshot = tg;

    // Signal to Telegram that the WebApp is ready
    tg.ready();

    // Expand to full height for better UX
    if (!tg.isExpanded) {
      tg.expand();
    }

    // HIGH-1 FIX: Bind ThemeParams with previous value comparison
    previousThemeRef.current = bindThemeToCss(
      tg.themeParams,
      previousThemeRef.current
    );

    // Bind safe area insets to CSS variables
    bindSafeAreaToCss(tg.safeAreaInset);

    // CRITICAL-1 & CRITICAL-2 FIX: Stable function references created ONCE
    const handleThemeChanged = () => {
      // HIGH-1 FIX: Only update changed CSS variables
      previousThemeRef.current = bindThemeToCss(
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

    // CRITICAL-3 FIX: Listen for viewport changes
    const handleViewportChanged = () => {
      setViewportHeight(webAppSnapshot.viewportStableHeight);
    };

    if (typeof tg.onEvent === 'function') {
      tg.onEvent('themeChanged', handleThemeChanged);
      tg.onEvent('safeAreaChanged', handleSafeAreaChanged);
      // CRITICAL-3 FIX: Add viewportChanged listener
      tg.onEvent('viewportChanged', handleViewportChanged);
    }

    // CRITICAL-3 FIX: Set initial viewport height
    setViewportHeight(tg.viewportStableHeight);
    setWebApp(webAppSnapshot);
    setIsReady(true);

    // CRITICAL-1 FIX: Cleanup with SAME stable function references
    return () => {
      if (typeof tg.offEvent === 'function') {
        tg.offEvent('themeChanged', handleThemeChanged);
        tg.offEvent('safeAreaChanged', handleSafeAreaChanged);
        tg.offEvent('viewportChanged', handleViewportChanged);
      }
    };
  }, []); // Empty deps - run once only

  // MED-1 FIX: Remove useMemo for simple property access
  // Simple property access - no need for useMemo overhead
  const isWebApp = !!webApp?.initData;
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

  // Haptic feedback
  const hapticFeedback = useMemo(() => ({
    impact: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => {
      webApp?.HapticFeedback?.impactOccurred(style);
    },
    notification: (type: 'error' | 'success' | 'warning') => {
      webApp?.HapticFeedback?.notificationOccurred(type);
    },
    selection: () => {
      webApp?.HapticFeedback?.selectionChanged();
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
    viewportHeight, // CRITICAL-3 FIX: Export viewport height
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
  return !!window.Telegram?.WebApp?.initData;
}
