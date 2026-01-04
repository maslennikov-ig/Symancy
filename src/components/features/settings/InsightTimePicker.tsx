/**
 * InsightTimePicker Component
 *
 * Combined toggle and time picker for configuring daily insight delivery times.
 * Allows enabling/disabling a specific insight type and selecting the hour for delivery.
 *
 * @module components/features/settings/InsightTimePicker
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';

// ============================================================================
// Types
// ============================================================================

export interface InsightTimePickerProps {
  /** Label for the insight type (e.g., "Morning Advice") */
  label: string;
  /** Whether this insight is enabled */
  enabled: boolean;
  /** Time in "HH:00" format (e.g., "09:00") */
  time: string;
  /** Callback when enabled state changes */
  onEnabledChange: (enabled: boolean) => void;
  /** Callback when time changes */
  onTimeChange: (time: string) => void;
}

// ============================================================================
// Constants
// ============================================================================

const HOURS: string[] = Array.from({ length: 24 }, (_, i) =>
  `${i.toString().padStart(2, '0')}:00`
);

// ============================================================================
// Icon Components
// ============================================================================

function ClockIcon(): React.ReactElement {
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
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function ChevronDownIcon(): React.ReactElement {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function CheckIcon(): React.ReactElement {
  return (
    <svg
      width="14"
      height="14"
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

// ============================================================================
// Component
// ============================================================================

/**
 * InsightTimePicker - Toggle with time picker for daily insights
 *
 * Displays a settings row with:
 * - Label on the left
 * - Toggle switch in the middle
 * - Time picker button on the right (when enabled)
 *
 * @example
 * ```tsx
 * function InsightSettings() {
 *   const [morningEnabled, setMorningEnabled] = useState(true);
 *   const [morningTime, setMorningTime] = useState('09:00');
 *
 *   return (
 *     <InsightTimePicker
 *       label="Morning Advice"
 *       enabled={morningEnabled}
 *       time={morningTime}
 *       onEnabledChange={setMorningEnabled}
 *       onTimeChange={setMorningTime}
 *     />
 *   );
 * }
 * ```
 */
export function InsightTimePicker({
  label,
  enabled,
  time,
  onEnabledChange,
  onTimeChange,
}: InsightTimePickerProps): React.ReactElement {
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const timePickerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isTimePickerOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (timePickerRef.current && !timePickerRef.current.contains(event.target as Node)) {
        setIsTimePickerOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isTimePickerOpen]);

  const handleTimeSelect = useCallback(
    (selectedTime: string) => {
      onTimeChange(selectedTime);
      setIsTimePickerOpen(false);
    },
    [onTimeChange]
  );

  const handleTimePickerKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsTimePickerOpen(!isTimePickerOpen);
      } else if (e.key === 'Escape' && isTimePickerOpen) {
        setIsTimePickerOpen(false);
      }
    },
    [isTimePickerOpen]
  );

  const handleOptionKeyDown = useCallback(
    (e: React.KeyboardEvent, hour: string) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleTimeSelect(hour);
      }
    },
    [handleTimeSelect]
  );

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 0',
        borderBottom: '1px solid var(--tg-theme-hint-color, hsl(var(--border)))',
        position: 'relative',
      }}
    >
      {/* Label */}
      <span
        style={{
          color: 'var(--tg-theme-text-color, hsl(var(--foreground)))',
          fontSize: '15px',
          flex: 1,
        }}
      >
        {label}
      </span>

      {/* Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        {/* Time Picker Button (only when enabled) */}
        {enabled && (
          <div ref={timePickerRef} style={{ position: 'relative' }}>
            <button
              type="button"
              role="combobox"
              aria-haspopup="listbox"
              aria-expanded={isTimePickerOpen}
              aria-label={`Select time: ${time}`}
              tabIndex={0}
              onClick={() => setIsTimePickerOpen(!isTimePickerOpen)}
              onKeyDown={handleTimePickerKeyDown}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid var(--tg-theme-hint-color, hsl(var(--border)))',
                backgroundColor: 'var(--tg-theme-secondary-bg-color, hsl(var(--accent)))',
                color: 'var(--tg-theme-text-color, hsl(var(--foreground)))',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background-color 0.2s ease',
              }}
            >
              <ClockIcon />
              <span>{time}</span>
              <ChevronDownIcon />
            </button>

            {/* Time Dropdown */}
            {isTimePickerOpen && (
              <div
                role="listbox"
                aria-label="Select hour"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  marginTop: '4px',
                  backgroundColor: 'var(--tg-theme-bg-color, hsl(var(--card)))',
                  border: '1px solid var(--tg-theme-hint-color, hsl(var(--border)))',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  zIndex: 100,
                  minWidth: '100px',
                  maxHeight: '200px',
                  overflow: 'auto',
                }}
              >
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    role="option"
                    aria-selected={hour === time}
                    tabIndex={0}
                    onClick={() => handleTimeSelect(hour)}
                    onKeyDown={(e) => handleOptionKeyDown(e, hour)}
                    style={{
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      fontSize: '14px',
                      color: 'var(--tg-theme-text-color, hsl(var(--foreground)))',
                      backgroundColor:
                        hour === time
                          ? 'var(--tg-theme-secondary-bg-color, hsl(var(--accent)))'
                          : 'transparent',
                    }}
                  >
                    <span>{hour}</span>
                    {hour === time && (
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
        )}

        {/* Toggle Switch */}
        <Switch
          checked={enabled}
          onCheckedChange={onEnabledChange}
          aria-label={`${label} ${enabled ? 'enabled' : 'disabled'}`}
        />
      </div>
    </div>
  );
}

export default InsightTimePicker;
