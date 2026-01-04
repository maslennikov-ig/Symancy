/**
 * TimezoneSelector Component
 *
 * Dropdown component for selecting user timezone from a list of common timezones.
 * Uses IANA timezone format (e.g., 'Europe/Moscow').
 *
 * @module components/features/settings/TimezoneSelector
 */
import React, { useState, useCallback } from 'react';
import { translations } from '../../../lib/i18n';

// ============================================================================
// Types
// ============================================================================

export interface TimezoneSelectorProps {
  /** Current timezone in IANA format (e.g., 'Europe/Moscow') */
  currentTimezone: string;
  /** Callback when timezone is selected */
  onSelect: (timezone: string) => void;
  /** Translation function */
  t: (key: keyof typeof translations.en) => string;
}

interface TimezoneOption {
  code: string;
  label: string;
}

// ============================================================================
// Constants
// ============================================================================

const COMMON_TIMEZONES: TimezoneOption[] = [
  { code: 'Pacific/Honolulu', label: 'Hawaii (UTC-10)' },
  { code: 'America/Los_Angeles', label: 'Los Angeles (UTC-8)' },
  { code: 'America/Denver', label: 'Denver (UTC-7)' },
  { code: 'America/Chicago', label: 'Chicago (UTC-6)' },
  { code: 'America/New_York', label: 'New York (UTC-5)' },
  { code: 'America/Sao_Paulo', label: 'Sao Paulo (UTC-3)' },
  { code: 'Europe/London', label: 'London (UTC+0)' },
  { code: 'Europe/Paris', label: 'Paris (UTC+1)' },
  { code: 'Europe/Moscow', label: 'Moscow (UTC+3)' },
  { code: 'Asia/Dubai', label: 'Dubai (UTC+4)' },
  { code: 'Asia/Kolkata', label: 'Mumbai (UTC+5:30)' },
  { code: 'Asia/Bangkok', label: 'Bangkok (UTC+7)' },
  { code: 'Asia/Shanghai', label: 'Shanghai (UTC+8)' },
  { code: 'Asia/Tokyo', label: 'Tokyo (UTC+9)' },
  { code: 'Australia/Sydney', label: 'Sydney (UTC+11)' },
  { code: 'Pacific/Auckland', label: 'Auckland (UTC+12)' },
];

// ============================================================================
// Icon Components
// ============================================================================

function ChevronRightIcon(): React.ReactElement {
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
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function CheckIcon(): React.ReactElement {
  return (
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
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function GlobeIcon(): React.ReactElement {
  return (
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
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

// ============================================================================
// Component
// ============================================================================

/**
 * TimezoneSelector - Dropdown for selecting user timezone
 *
 * Displays a settings row that opens a dropdown with common timezones.
 * Matches the LanguageSelector and ThemeSelector patterns from Profile.tsx.
 *
 * @example
 * ```tsx
 * function SettingsPage() {
 *   const [timezone, setTimezone] = useState('Europe/Moscow');
 *
 *   return (
 *     <TimezoneSelector
 *       currentTimezone={timezone}
 *       onSelect={setTimezone}
 *       t={t}
 *     />
 *   );
 * }
 * ```
 */
export function TimezoneSelector({
  currentTimezone,
  onSelect,
  t,
}: TimezoneSelectorProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);

  const currentTz = COMMON_TIMEZONES.find((tz) => tz.code === currentTimezone);
  const displayValue = currentTz?.label || currentTimezone;

  const handleSelect = useCallback(
    (timezone: string) => {
      onSelect(timezone);
      setIsOpen(false);
    },
    [onSelect]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(!isOpen);
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    },
    [isOpen]
  );

  const handleOptionKeyDown = useCallback(
    (e: React.KeyboardEvent, timezone: string) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleSelect(timezone);
      }
    },
    [handleSelect]
  );

  return (
    <div style={{ position: 'relative' }}>
      <div
        role="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={t('profile.timezone')}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        {/* Settings Row */}
        <div
          onClick={() => setIsOpen(!isOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 0',
            borderBottom: '1px solid var(--tg-theme-hint-color, hsl(var(--border)))',
            cursor: 'pointer',
          }}
        >
          <span
            style={{
              color: 'var(--tg-theme-text-color, hsl(var(--foreground)))',
              fontSize: '15px',
            }}
          >
            {t('profile.timezone')}
          </span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: 'var(--tg-theme-hint-color, hsl(var(--muted-foreground)))',
            }}
          >
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '14px',
              }}
            >
              <GlobeIcon />
              {displayValue}
            </span>
            <ChevronRightIcon />
          </div>
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          role="listbox"
          aria-label={t('profile.timezone')}
          style={{
            position: 'absolute',
            right: 0,
            top: '100%',
            backgroundColor: 'var(--tg-theme-bg-color, hsl(var(--card)))',
            border: '1px solid var(--tg-theme-hint-color, hsl(var(--border)))',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 100,
            minWidth: '200px',
            maxHeight: '300px',
            overflow: 'auto',
          }}
        >
          {COMMON_TIMEZONES.map((tz) => (
            <div
              key={tz.code}
              role="option"
              aria-selected={tz.code === currentTimezone}
              tabIndex={0}
              onClick={() => handleSelect(tz.code)}
              onKeyDown={(e) => handleOptionKeyDown(e, tz.code)}
              style={{
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                backgroundColor:
                  tz.code === currentTimezone
                    ? 'var(--tg-theme-secondary-bg-color, hsl(var(--accent)))'
                    : 'transparent',
              }}
            >
              <span
                style={{
                  fontSize: '14px',
                  color: 'var(--tg-theme-text-color, hsl(var(--foreground)))',
                }}
              >
                {tz.label}
              </span>
              {tz.code === currentTimezone && (
                <span
                  style={{ color: 'var(--tg-theme-button-color, hsl(var(--primary)))' }}
                  aria-hidden="true"
                >
                  <CheckIcon />
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TimezoneSelector;
