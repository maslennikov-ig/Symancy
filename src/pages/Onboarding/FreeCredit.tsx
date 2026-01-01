/**
 * FreeCredit Step - Onboarding Step 4
 *
 * Final step of the onboarding flow presenting the free credit gift.
 * Shows gift animation and grants one free analysis credit.
 *
 * @module pages/Onboarding/FreeCredit
 */
import React, { useCallback, useState, useEffect } from 'react';
import { translations, Lang } from '../../lib/i18n';
import { useMainButton } from '../../hooks/useMainButton';
import { useTelegramWebApp } from '../../hooks/useTelegramWebApp';

/**
 * FreeCreditProps - Props for FreeCredit component
 */
interface FreeCreditProps {
  /** Current language */
  language: Lang;
  /** Translation function */
  t: (key: keyof typeof translations.en) => string;
  /** Callback when user claims the gift */
  onComplete: () => void;
  /** Whether credit is being granted */
  isLoading: boolean;
  /** Error message if granting failed */
  error: string | null;
}

/**
 * FreeCredit - Onboarding Step 4
 *
 * Shows:
 * - Gift emoji with animation
 * - Title: "A gift for you!"
 * - Card showing star + free analysis
 * - Message explaining the gift
 * - MainButton: "Get Gift"
 * - Loading state while granting
 * - Error state if granting fails
 */
export const FreeCredit: React.FC<FreeCreditProps> = ({
  language,
  t,
  onComplete,
  isLoading,
  error,
}) => {
  const { hapticFeedback } = useTelegramWebApp();
  const [hasAnimated, setHasAnimated] = useState(false);

  // Trigger animation on mount
  useEffect(() => {
    const timer = setTimeout(() => setHasAnimated(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Stable callback for MainButton
  const handleGetGift = useCallback(() => {
    if (!isLoading) {
      hapticFeedback.notification('success');
      onComplete();
    }
  }, [onComplete, isLoading, hapticFeedback]);

  // Set up MainButton
  useMainButton({
    text: isLoading ? t('onboarding.freeCredit.receiving') : t('onboarding.button.getGift'),
    visible: true,
    disabled: isLoading,
    onClick: handleGetGift,
  });

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
      {/* Gift emoji with bounce animation */}
      <div
        className={`text-8xl mb-6 transition-transform duration-500 ${
          hasAnimated ? 'scale-100 animate-bounce' : 'scale-0'
        }`}
      >
        <span role="img" aria-label="Gift">
          🎁
        </span>
      </div>

      {/* Title */}
      <h1 className="text-3xl font-bold text-foreground mb-6">
        {t('onboarding.freeCredit.title')}
      </h1>

      {/* Credit card */}
      <div
        className={`w-full max-w-xs p-6 bg-gradient-to-br from-primary/20 to-primary/5
          rounded-2xl border-2 border-primary/30 shadow-lg
          transition-all duration-500 ${hasAnimated ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
      >
        {/* Star icon */}
        <div className="text-5xl mb-3">
          <span role="img" aria-label="Star">
            ⭐
          </span>
        </div>

        {/* Credit amount */}
        <div className="text-2xl font-bold text-primary">{t('onboarding.freeCredit.amount')}</div>
      </div>

      {/* Message */}
      <p className="mt-6 text-base text-muted-foreground max-w-xs leading-relaxed">
        {t('onboarding.freeCredit.message')}
      </p>

      {/* Error message */}
      {error && (
        <div className="mt-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="mt-4 flex items-center gap-2 text-muted-foreground">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span>{t('onboarding.freeCredit.receiving')}</span>
        </div>
      )}

      {/* Confetti/celebration elements */}
      <div
        className={`mt-8 flex items-center gap-4 text-2xl transition-opacity duration-700 ${
          hasAnimated ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <span>🎉</span>
        <span>✨</span>
        <span>🎊</span>
      </div>
    </div>
  );
};
