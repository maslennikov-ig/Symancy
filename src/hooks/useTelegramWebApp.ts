/**
 * Telegram WebApp Hook
 *
 * Provides access to Telegram WebApp API for Mini Apps.
 * Reads initData, handles theming, and provides WebApp utilities.
 *
 * @module hooks/useTelegramWebApp
 */
import { useState, useEffect, useCallback, useMemo } from 'react';

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
  ready: () => void;
  expand: () => void;
  close: () => void;
  enableClosingConfirmation: () => void;
  disableClosingConfirmation: () => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
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
export function useTelegramWebApp(): UseTelegramWebAppReturn {
  const [isReady, setIsReady] = useState(false);
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);

  // Initialize WebApp on mount
  useEffect(() => {
    const tg = window.Telegram?.WebApp;

    if (tg) {
      // Signal to Telegram that the WebApp is ready
      tg.ready();

      // Expand to full height for better UX
      if (!tg.isExpanded) {
        tg.expand();
      }

      setWebApp(tg);
      setIsReady(true);
    }

    // L4 FIX: Cleanup function for future-proofing
    // Currently no-op, but prepares for future event listener cleanup
    return () => {
      // Future: Remove event listeners if added
      // tg?.MainButton.offClick(someHandler);
      // tg?.BackButton.offClick(someHandler);
    };
  }, []);

  // Check if running in WebApp context
  const isWebApp = useMemo(() => {
    return !!webApp && !!webApp.initData;
  }, [webApp]);

  // Extract initData for server verification
  const initData = useMemo(() => {
    return webApp?.initData || null;
  }, [webApp]);

  // Extract user data (unverified, for display only)
  const user = useMemo(() => {
    return webApp?.initDataUnsafe?.user || null;
  }, [webApp]);

  // Extract start parameter
  const startParam = useMemo(() => {
    return webApp?.initDataUnsafe?.start_param || null;
  }, [webApp]);

  // Theme
  const colorScheme = useMemo(() => {
    return webApp?.colorScheme || 'light';
  }, [webApp]);

  const themeParams = useMemo(() => {
    return webApp?.themeParams || {};
  }, [webApp]);

  // Version and platform
  const version = useMemo(() => {
    return webApp?.version || null;
  }, [webApp]);

  const platform = useMemo(() => {
    return webApp?.platform || null;
  }, [webApp]);

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
