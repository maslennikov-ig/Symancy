/**
 * Telegram Notifications Hook
 *
 * Manages push notification permissions for Telegram Mini App using requestWriteAccess API.
 * Syncs permission state with CloudStorage and backend unified_users table.
 *
 * @module hooks/useNotifications
 */
import { useState, useCallback, useEffect } from 'react';
import { useCloudStorage } from './useCloudStorage';
import { useTelegramWebApp } from './useTelegramWebApp';
import { getStoredToken } from '../services/authService';

// ============================================================================
// Types
// ============================================================================

/**
 * Notification settings stored in backend
 */
export interface NotificationSettings {
  /** Whether notifications are enabled */
  enabled: boolean;
  /** Types of notifications the user wants to receive */
  types?: {
    dailyFortune?: boolean;
    weeklyCheckin?: boolean;
    tips?: boolean;
  };
}

/**
 * Hook return type
 */
export interface UseNotificationsReturn {
  /** Whether notifications are currently enabled */
  isEnabled: boolean;
  /** Whether permission request or toggle is in progress */
  isLoading: boolean;
  /** Whether requestWriteAccess API is available */
  isAvailable: boolean;
  /** Error message if any operation failed */
  error: string | null;
  /** Request notification permission from Telegram */
  requestPermission: () => Promise<boolean>;
  /** Disable notifications */
  disableNotifications: () => Promise<void>;
  /** Toggle notifications on/off */
  toggleNotifications: () => Promise<void>;
}

// ============================================================================
// Constants
// ============================================================================

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if requestWriteAccess API is available
 */
function isWriteAccessAvailable(): boolean {
  return typeof window.Telegram?.WebApp?.requestWriteAccess === 'function';
}

/**
 * Promisified wrapper for requestWriteAccess
 *
 * @returns Promise resolving to 'allowed' or 'cancelled'
 */
function requestWriteAccessPromise(): Promise<'allowed' | 'cancelled'> {
  return new Promise((resolve) => {
    const webApp = window.Telegram?.WebApp;

    if (!webApp?.requestWriteAccess) {
      // API not available - resolve as cancelled
      console.warn('[useNotifications] requestWriteAccess API not available');
      resolve('cancelled');
      return;
    }

    webApp.requestWriteAccess((status: boolean) => {
      // The callback receives a boolean: true = allowed, false = cancelled
      resolve(status ? 'allowed' : 'cancelled');
    });
  });
}

/**
 * Update notification settings in backend
 *
 * @param settings - Notification settings to update
 * @param token - JWT token for authentication
 */
async function updateBackendNotificationSettings(
  settings: NotificationSettings,
  token: string
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/users/notification-settings`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ notification_settings: settings }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to update settings' }));
    throw new Error(error.message || 'Failed to update notification settings');
  }
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for managing Telegram push notification permissions
 *
 * Uses Telegram's requestWriteAccess API (Bot API 6.9+) to request permission
 * to send messages to the user. Syncs state with CloudStorage and backend.
 *
 * @returns UseNotificationsReturn - Notification state and control functions
 *
 * @example
 * ```tsx
 * function NotificationSettings() {
 *   const {
 *     isEnabled,
 *     isLoading,
 *     isAvailable,
 *     requestPermission,
 *     disableNotifications
 *   } = useNotifications();
 *
 *   if (!isAvailable) {
 *     return <p>Notifications not available</p>;
 *   }
 *
 *   return (
 *     <Switch
 *       checked={isEnabled}
 *       disabled={isLoading}
 *       onChange={() => isEnabled ? disableNotifications() : requestPermission()}
 *     />
 *   );
 * }
 * ```
 */
export function useNotifications(): UseNotificationsReturn {
  const { preferences, updatePreferences, isLoading: preferencesLoading } = useCloudStorage();
  const { hapticFeedback, webApp } = useTelegramWebApp();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);

  // Check API availability on mount
  useEffect(() => {
    setIsAvailable(isWriteAccessAvailable());
  }, [webApp]);

  // Derive enabled state from preferences
  const isEnabled = preferences.notificationsEnabled;

  /**
   * Request notification permission from Telegram
   *
   * @returns Promise<boolean> - True if permission was granted
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isWriteAccessAvailable()) {
      setError('Notification API not available');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Request permission from Telegram
      const status = await requestWriteAccessPromise();
      const granted = status === 'allowed';

      // Provide haptic feedback
      if (granted) {
        hapticFeedback.notification('success');
      } else {
        hapticFeedback.notification('warning');
      }

      // Update CloudStorage
      await updatePreferences({ notificationsEnabled: granted });

      // Update backend (if authenticated)
      const token = getStoredToken();
      if (token) {
        try {
          await updateBackendNotificationSettings({ enabled: granted }, token);
        } catch (backendError) {
          // Log but don't fail - CloudStorage is the source of truth for now
          console.warn('[useNotifications] Backend update failed:', backendError);
        }
      }

      return granted;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to request permission';
      console.error('[useNotifications] requestPermission error:', err);
      setError(message);
      hapticFeedback.notification('error');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [hapticFeedback, updatePreferences]);

  /**
   * Disable notifications
   */
  const disableNotifications = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      // Provide haptic feedback
      hapticFeedback.impact('light');

      // Update CloudStorage
      await updatePreferences({ notificationsEnabled: false });

      // Update backend (if authenticated)
      const token = getStoredToken();
      if (token) {
        try {
          await updateBackendNotificationSettings({ enabled: false }, token);
        } catch (backendError) {
          console.warn('[useNotifications] Backend update failed:', backendError);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to disable notifications';
      console.error('[useNotifications] disableNotifications error:', err);
      setError(message);
      hapticFeedback.notification('error');
    } finally {
      setIsLoading(false);
    }
  }, [hapticFeedback, updatePreferences]);

  /**
   * Toggle notifications on/off
   */
  const toggleNotifications = useCallback(async (): Promise<void> => {
    if (isEnabled) {
      await disableNotifications();
    } else {
      await requestPermission();
    }
  }, [isEnabled, disableNotifications, requestPermission]);

  return {
    isEnabled,
    isLoading: isLoading || preferencesLoading,
    isAvailable,
    error,
    requestPermission,
    disableNotifications,
    toggleNotifications,
  };
}

/**
 * Check if notification API is available (synchronous, for guards)
 *
 * @returns True if requestWriteAccess API is available
 */
export function hasNotificationSupport(): boolean {
  return isWriteAccessAvailable();
}
