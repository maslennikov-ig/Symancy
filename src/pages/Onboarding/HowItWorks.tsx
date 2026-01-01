/**
 * HowItWorks Step - Onboarding Step 3
 *
 * Third step of the onboarding flow explaining how the app works.
 * Shows flow icons and 3 steps of the analysis process.
 *
 * @module pages/Onboarding/HowItWorks
 */
import React, { useCallback } from 'react';
import { translations, Lang } from '../../lib/i18n';
import { useMainButton } from '../../hooks/useMainButton';

/**
 * HowItWorksProps - Props for HowItWorks component
 */
interface HowItWorksProps {
  /** Current language */
  language: Lang;
  /** Translation function */
  t: (key: keyof typeof translations.en) => string;
  /** Callback when user clicks Continue */
  onNext: () => void;
}

/**
 * Step configuration for the how-it-works flow
 */
interface StepConfig {
  icon: string;
  translationKey: keyof typeof translations.en;
}

/**
 * Steps in the how-it-works flow
 */
const STEPS: StepConfig[] = [
  { icon: '📷', translationKey: 'onboarding.howItWorks.step1' },
  { icon: '☕', translationKey: 'onboarding.howItWorks.step2' },
  { icon: '🔮', translationKey: 'onboarding.howItWorks.step3' },
];

/**
 * HowItWorks - Onboarding Step 3
 *
 * Shows:
 * - Flow icons: camera -> coffee -> crystal ball
 * - Title: "How it works:"
 * - 3 numbered steps with descriptions
 * - MainButton: "Continue"
 */
export const HowItWorks: React.FC<HowItWorksProps> = ({ language, t, onNext }) => {
  // Stable callback for MainButton
  const handleContinue = useCallback(() => {
    onNext();
  }, [onNext]);

  // Set up MainButton
  useMainButton({
    text: t('onboarding.button.continue'),
    visible: true,
    onClick: handleContinue,
  });

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
      {/* Flow icons header */}
      <div className="flex items-center gap-3 mb-8">
        {STEPS.map((step, index) => (
          <React.Fragment key={step.translationKey}>
            {/* Step icon */}
            <div className="text-4xl">{step.icon}</div>

            {/* Arrow between steps (not after last) */}
            {index < STEPS.length - 1 && (
              <div className="text-2xl text-muted-foreground">→</div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Title */}
      <h1 className="text-2xl font-bold text-foreground mb-8">
        {t('onboarding.howItWorks.title')}
      </h1>

      {/* Steps list */}
      <div className="w-full max-w-sm space-y-4">
        {STEPS.map((step, index) => (
          <div
            key={step.translationKey}
            className="flex items-start gap-4 text-left p-4 bg-card rounded-xl border border-border"
          >
            {/* Step number */}
            <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
              {index + 1}
            </div>

            {/* Step content */}
            <div className="flex-1">
              {/* Step icon inline */}
              <span className="text-2xl mr-2">{step.icon}</span>

              {/* Step description */}
              <span className="text-base text-foreground">{t(step.translationKey)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Decorative sparkles */}
      <div className="mt-8 text-muted-foreground text-2xl">✨</div>
    </div>
  );
};
