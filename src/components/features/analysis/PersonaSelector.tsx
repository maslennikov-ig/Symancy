import React from 'react';
import { cn } from '../../../lib/utils';
import { useTelegramWebApp } from '../../../hooks/useTelegramWebApp';

/**
 * Persona type for coffee analysis
 * - arina: Basic persona - warm and friendly, costs 1 basic credit
 * - cassandra: Pro persona - mystical and mysterious, costs 1 cassandra credit
 */
export type Persona = 'arina' | 'cassandra';

/**
 * Props for the PersonaSelector component
 */
export interface PersonaSelectorProps {
  /** Currently selected persona */
  selectedPersona: Persona;
  /** Callback when persona is selected */
  onSelect: (persona: Persona) => void;
  /** User's basic credit balance */
  basicCredits: number;
  /** User's cassandra credit balance */
  cassandraCredits: number;
  /** Current language (for ARIA labels) */
  language: 'ru' | 'en' | 'zh';
  /** Translation function */
  t: (key: string) => string;
  /** Optional className for the container */
  className?: string;
}

/**
 * Persona configuration for rendering cards
 */
interface PersonaConfig {
  id: Persona;
  nameKey: string;
  descriptionKey: string;
  icon: string;
  creditIcon: string;
  creditType: 'basic' | 'cassandra';
  badgeClass: string;
  selectedBorderClass: string;
  iconBgClass: string;
}

const PERSONA_CONFIGS: PersonaConfig[] = [
  {
    id: 'arina',
    nameKey: 'analysis.persona.arina.name',
    descriptionKey: 'analysis.persona.arina.description',
    icon: '\u2615', // Coffee cup emoji
    creditIcon: '\u2B50', // Star emoji
    creditType: 'basic',
    badgeClass: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    selectedBorderClass: 'border-green-500 ring-green-500',
    iconBgClass: 'bg-green-100 dark:bg-green-900/50',
  },
  {
    id: 'cassandra',
    nameKey: 'analysis.persona.cassandra.name',
    descriptionKey: 'analysis.persona.cassandra.description',
    icon: '\uD83D\uDD2E', // Crystal ball emoji
    creditIcon: '\uD83D\uDC8E', // Gem emoji
    creditType: 'cassandra',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    selectedBorderClass: 'border-amber-500 ring-amber-500',
    iconBgClass: 'bg-amber-100 dark:bg-amber-900/50',
  },
];

/**
 * PersonaSelector component for choosing between Arina and Cassandra personas.
 *
 * Features:
 * - Two side-by-side cards with icons and descriptions
 * - Visual selection state with border highlight and scale effect
 * - Haptic feedback on selection (Telegram WebApp)
 * - Disabled state when insufficient credits
 * - Dark/light theme support
 * - Full accessibility with ARIA labels
 *
 * @example
 * ```tsx
 * <PersonaSelector
 *   selectedPersona="arina"
 *   onSelect={(persona) => setSelectedPersona(persona)}
 *   basicCredits={5}
 *   cassandraCredits={0}
 *   language="en"
 *   t={(key) => translations[key]}
 * />
 * ```
 */
export function PersonaSelector({
  selectedPersona,
  onSelect,
  basicCredits,
  cassandraCredits,
  language,
  t,
  className,
}: PersonaSelectorProps) {
  const { hapticFeedback } = useTelegramWebApp();

  /**
   * Get credit balance for a given credit type
   */
  const getCredits = (creditType: 'basic' | 'cassandra'): number => {
    return creditType === 'basic' ? basicCredits : cassandraCredits;
  };

  /**
   * Check if persona can be selected (has sufficient credits)
   */
  const canSelect = (config: PersonaConfig): boolean => {
    return getCredits(config.creditType) >= 1;
  };

  /**
   * Handle persona card click
   */
  const handleSelect = (config: PersonaConfig) => {
    if (!canSelect(config)) return;

    // Trigger haptic feedback
    hapticFeedback.selection();

    onSelect(config.id);
  };

  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = (e: React.KeyboardEvent, config: PersonaConfig) => {
    if ((e.key === 'Enter' || e.key === ' ') && canSelect(config)) {
      e.preventDefault();
      handleSelect(config);
    }
  };

  return (
    <div className={cn('space-y-3', className)}>
      {/* Title */}
      <h3 className="text-sm font-medium text-muted-foreground">
        {t('analysis.persona.title')}
      </h3>

      {/* Persona cards grid */}
      <div
        className="grid grid-cols-2 gap-3"
        role="radiogroup"
        aria-label={t('analysis.persona.title')}
      >
        {PERSONA_CONFIGS.map((config) => {
          const isSelected = selectedPersona === config.id;
          const isDisabled = !canSelect(config);
          const credits = getCredits(config.creditType);

          return (
            <div
              key={config.id}
              role="radio"
              aria-checked={isSelected}
              aria-disabled={isDisabled}
              aria-label={`${t(config.nameKey)} - ${t(config.descriptionKey)}${isDisabled ? ` - ${t('analysis.persona.insufficient')}` : ''}`}
              tabIndex={isDisabled ? -1 : 0}
              onClick={() => handleSelect(config)}
              onKeyDown={(e) => handleKeyDown(e, config)}
              className={cn(
                // Base styles
                'relative rounded-xl border-2 p-4 cursor-pointer',
                'transition-all duration-200 ease-out',
                'focus:outline-none focus:ring-2 focus:ring-offset-2',
                // Default border
                'border-border',
                // Hover state (when not disabled)
                !isDisabled && 'hover:border-primary/50 hover:shadow-md hover:scale-[1.02]',
                // Selected state
                isSelected && [
                  'ring-2',
                  config.selectedBorderClass,
                  'shadow-md scale-[1.02]',
                ],
                // Disabled state
                isDisabled && [
                  'opacity-50 cursor-not-allowed',
                  'hover:scale-100 hover:shadow-none hover:border-border',
                ],
                // Background
                'bg-card'
              )}
            >
              {/* Selection indicator (checkmark) */}
              {isSelected && (
                <div className="absolute top-2 right-2">
                  <div
                    className={cn(
                      'w-5 h-5 rounded-full flex items-center justify-center',
                      config.id === 'arina'
                        ? 'bg-green-500 text-white'
                        : 'bg-amber-500 text-white'
                    )}
                  >
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                </div>
              )}

              {/* Icon */}
              <div
                className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center mb-3',
                  config.iconBgClass
                )}
              >
                <span className="text-2xl" role="img" aria-hidden="true">
                  {config.icon}
                </span>
              </div>

              {/* Name */}
              <h4 className="font-semibold text-foreground mb-1">
                {t(config.nameKey)}
              </h4>

              {/* Description */}
              <p className="text-xs text-muted-foreground mb-3">
                {t(config.descriptionKey)}
              </p>

              {/* Credit cost and balance */}
              <div className="flex items-center justify-between">
                {/* Cost badge */}
                <span
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full',
                    config.badgeClass
                  )}
                >
                  <span role="img" aria-hidden="true">
                    {config.creditIcon}
                  </span>
                  <span>1</span>
                </span>

                {/* Balance indicator */}
                <span
                  className={cn(
                    'text-xs',
                    isDisabled
                      ? 'text-destructive font-medium'
                      : 'text-muted-foreground'
                  )}
                >
                  {isDisabled ? (
                    t('analysis.persona.insufficient')
                  ) : (
                    <span className="flex items-center gap-1">
                      <span role="img" aria-hidden="true">
                        {config.creditIcon}
                      </span>
                      <span>{credits}</span>
                    </span>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
