/**
 * Welcome Step - Onboarding Step 1
 *
 * First step of the onboarding flow showing app introduction.
 * Displays coffee cup emoji, title, subtitle, and start button.
 *
 * @module pages/Onboarding/Welcome
 */
import React, { useCallback } from 'react';
import { translations, Lang } from '../../lib/i18n';
import { useMainButton } from '../../hooks/useMainButton';

/**
 * WelcomeProps - Props for Welcome component
 */
interface WelcomeProps {
  /** Current language */
  language: Lang;
  /** Translation function */
  t: (key: keyof typeof translations.en) => string;
  /** Callback when user clicks Start */
  onNext: () => void;
}

/**
 * Welcome - Onboarding Step 1
 *
 * Shows:
 * - Coffee cup emoji centered
 * - App title: "Coffee Cup Psychologist"
 * - Subtitle: "Discover your future through coffee grounds"
 * - MainButton: "Start"
 */
export const Welcome: React.FC<WelcomeProps> = ({ language, t, onNext }) => {
  // Stable callback for MainButton
  const handleStart = useCallback(() => {
    onNext();
  }, [onNext]);

  // Set up MainButton
  useMainButton({
    text: t('onboarding.button.start'),
    visible: true,
    onClick: handleStart,
  });

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
      {/* Coffee cup emoji */}
      <div className="text-8xl mb-8 animate-pulse">
        <span role="img" aria-label="Coffee cup">
          ☕
        </span>
      </div>

      {/* Title */}
      <h1 className="text-3xl font-bold text-foreground mb-4">
        {t('onboarding.welcome.title')}
      </h1>

      {/* Subtitle */}
      <p className="text-lg text-muted-foreground max-w-xs leading-relaxed">
        {t('onboarding.welcome.subtitle')}
      </p>

      {/* Decorative elements */}
      <div className="mt-12 flex items-center gap-4 opacity-40">
        <div className="w-16 h-px bg-muted-foreground" />
        <span className="text-muted-foreground text-sm">*</span>
        <div className="w-16 h-px bg-muted-foreground" />
      </div>
    </div>
  );
};
