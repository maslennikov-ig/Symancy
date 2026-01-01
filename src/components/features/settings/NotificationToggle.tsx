/**
 * NotificationToggle Component
 *
 * Toggle component for enabling/disabling push notifications in Telegram Mini App.
 * Uses Telegram's requestWriteAccess API and syncs with CloudStorage.
 *
 * @module components/features/settings/NotificationToggle
 */
import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useNotifications } from '../../../hooks/useNotifications';
import { useCloudStorage, type Language } from '../../../hooks/useCloudStorage';
import { useTranslation } from '../../../hooks/useTranslation';

// ============================================================================
// Types
// ============================================================================

export interface NotificationToggleProps {
  /** Optional CSS class name */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * NotificationToggle - Toggle for push notification permissions
 *
 * Displays current notification status with a toggle switch.
 * Shows description of what notifications include.
 * Provides haptic feedback on toggle.
 *
 * @example
 * ```tsx
 * function ProfilePage() {
 *   return (
 *     <div>
 *       <h2>Settings</h2>
 *       <NotificationToggle />
 *     </div>
 *   );
 * }
 * ```
 */
export function NotificationToggle({ className }: NotificationToggleProps) {
  const {
    isEnabled,
    isLoading,
    isAvailable,
    toggleNotifications,
  } = useNotifications();

  const { preferences } = useCloudStorage();
  const { t } = useTranslation(preferences.language as Language);

  // Don't render if API is not available (not in Telegram WebApp)
  if (!isAvailable) {
    return null;
  }

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '16px',
        backgroundColor: 'var(--tg-theme-secondary-bg-color, #f5f5f5)',
        borderRadius: '12px',
      }}
    >
      {/* Header with toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <Label
            htmlFor="notifications-toggle"
            style={{
              fontSize: '16px',
              fontWeight: 600,
              color: 'var(--tg-theme-text-color, #000)',
              cursor: 'pointer',
            }}
          >
            {t('notifications.title')}
          </Label>
          <span
            style={{
              fontSize: '13px',
              color: isEnabled
                ? 'var(--tg-theme-link-color, #3390ec)'
                : 'var(--tg-theme-hint-color, #999)',
            }}
          >
            {isEnabled ? t('notifications.enabled') : t('notifications.disabled')}
          </span>
        </div>

        <Switch
          id="notifications-toggle"
          checked={isEnabled}
          disabled={isLoading}
          onCheckedChange={toggleNotifications}
          aria-label={isEnabled ? t('notifications.disable') : t('notifications.enable')}
        />
      </div>

      {/* Description */}
      <p
        style={{
          margin: 0,
          fontSize: '14px',
          color: 'var(--tg-theme-hint-color, #999)',
          lineHeight: 1.4,
        }}
      >
        {t('notifications.description')}
      </p>

      {/* Notification types list */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          marginTop: '4px',
        }}
      >
        <NotificationTypeItem
          icon="coffee"
          label={t('notifications.types.dailyFortune')}
          enabled={isEnabled}
        />
        <NotificationTypeItem
          icon="calendar"
          label={t('notifications.types.weeklyCheckin')}
          enabled={isEnabled}
        />
        <NotificationTypeItem
          icon="lightbulb"
          label={t('notifications.types.tips')}
          enabled={isEnabled}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

interface NotificationTypeItemProps {
  icon: 'coffee' | 'calendar' | 'lightbulb';
  label: string;
  enabled: boolean;
}

/**
 * Individual notification type item
 */
function NotificationTypeItem({ icon, label, enabled }: NotificationTypeItemProps) {
  const iconMap = {
    coffee: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
        <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z" />
        <line x1="6" y1="2" x2="6" y2="4" />
        <line x1="10" y1="2" x2="10" y2="4" />
        <line x1="14" y1="2" x2="14" y2="4" />
      </svg>
    ),
    calendar: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    lightbulb: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 18h6" />
        <path d="M10 22h4" />
        <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
      </svg>
    ),
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        opacity: enabled ? 1 : 0.5,
        transition: 'opacity 0.2s ease',
      }}
    >
      <span
        style={{
          color: enabled
            ? 'var(--tg-theme-link-color, #3390ec)'
            : 'var(--tg-theme-hint-color, #999)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {iconMap[icon]}
      </span>
      <span
        style={{
          fontSize: '14px',
          color: 'var(--tg-theme-text-color, #000)',
        }}
      >
        {label}
      </span>
    </div>
  );
}

export default NotificationToggle;
