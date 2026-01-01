/**
 * Onboarding Flow Controller
 *
 * Main controller for the 4-step onboarding flow in the Telegram Mini App.
 * Manages step navigation, language selection, and onboarding completion.
 *
 * Steps:
 * 1. Welcome - Introduction to the app
 * 2. Language - Language selection
 * 3. HowItWorks - Explanation of the analysis process
 * 4. FreeCredit - Gift of free analysis credit
 *
 * @module pages/Onboarding
 */
import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { translations, Lang, t as i18n_t } from '../../lib/i18n';
import { useCloudStorage, type Language } from '../../hooks/useCloudStorage';
import { useTelegramWebApp } from '../../hooks/useTelegramWebApp';
import { Welcome } from './Welcome';
import { LanguageStep } from './Language';
import { HowItWorks } from './HowItWorks';
import { FreeCredit } from './FreeCredit';

/**
 * Step indicator component showing progress dots
 */
interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

function StepIndicator({ currentStep, totalSteps }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-2 py-4">
      {Array.from({ length: totalSteps }, (_, i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full transition-all duration-300 ${
            i + 1 === currentStep
              ? 'w-6 bg-primary'
              : i + 1 < currentStep
              ? 'bg-primary/50'
              : 'bg-muted-foreground/30'
          }`}
        />
      ))}
    </div>
  );
}

/**
 * OnboardingProps - Props for Onboarding component
 */
interface OnboardingProps {
  /** Current language (optional, uses preferences if not provided) */
  language?: Lang;
  /** Translation function (optional, creates one if not provided) */
  t?: (key: keyof typeof translations.en) => string;
}

/**
 * Onboarding - Main onboarding flow controller
 *
 * Manages the 4-step onboarding process with:
 * - Step navigation
 * - Language selection persistence
 * - Onboarding completion tracking
 * - MainButton integration for Telegram
 */
const Onboarding: React.FC<OnboardingProps> = ({ language: propLanguage, t: propT }) => {
  const navigate = useNavigate();
  const { preferences, updatePreferences, setOnboardingCompleted } = useCloudStorage();
  const { hapticFeedback } = useTelegramWebApp();

  // Current step in the onboarding flow (1-4)
  const [currentStep, setCurrentStep] = useState(1);
  const [isGrantingCredit, setIsGrantingCredit] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);

  // Use provided language or fall back to preferences
  const language = propLanguage || (preferences.language as Lang) || 'ru';
  const t = propT || ((key: keyof typeof translations.en) => i18n_t(key, language));

  // Total number of steps
  const totalSteps = 4;

  /**
   * Handle advancing to the next step
   */
  const handleNext = useCallback(() => {
    hapticFeedback.impact('light');
    if (currentStep < totalSteps) {
      setCurrentStep((prev) => prev + 1);
    }
  }, [currentStep, totalSteps, hapticFeedback]);

  /**
   * Handle language selection
   * Updates preferences and advances to next step
   */
  const handleLanguageSelect = useCallback(
    async (selectedLang: Language) => {
      hapticFeedback.selection();
      await updatePreferences({ language: selectedLang });
      // Small delay to ensure preference is saved before advancing
      setTimeout(() => {
        setCurrentStep(3);
      }, 100);
    },
    [updatePreferences, hapticFeedback]
  );

  /**
   * Handle onboarding completion
   * Grants free credit and marks onboarding as completed
   */
  const handleComplete = useCallback(async () => {
    hapticFeedback.notification('success');
    setIsGrantingCredit(true);
    setGrantError(null);

    try {
      // TODO: Call backend to grant free credit
      // For now, we'll just mark onboarding as completed
      // The actual credit granting would be:
      // await grantFreeCredit();

      await setOnboardingCompleted(true);

      // Navigate to home after a brief delay for visual feedback
      setTimeout(() => {
        navigate('/');
      }, 500);
    } catch (error) {
      console.error('[Onboarding] Failed to complete onboarding:', error);
      setGrantError(error instanceof Error ? error.message : t('onboarding.freeCredit.error'));
      hapticFeedback.notification('error');
    } finally {
      setIsGrantingCredit(false);
    }
  }, [setOnboardingCompleted, navigate, hapticFeedback, t]);

  /**
   * Render the current step component
   */
  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <Welcome language={language} t={t} onNext={handleNext} />;
      case 2:
        return (
          <LanguageStep
            language={language}
            t={t}
            onLanguageSelect={handleLanguageSelect}
            currentLanguage={preferences.language}
          />
        );
      case 3:
        return <HowItWorks language={language} t={t} onNext={handleNext} />;
      case 4:
        return (
          <FreeCredit
            language={language}
            t={t}
            onComplete={handleComplete}
            isLoading={isGrantingCredit}
            error={grantError}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div
      className="min-h-screen bg-background flex flex-col"
      style={{
        paddingTop: 'var(--tg-content-safe-area-inset-top, 0px)',
        paddingBottom: 'var(--tg-content-safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Main content - takes remaining space */}
      <div className="flex-1 flex flex-col">{renderStep()}</div>

      {/* Step indicator at the bottom */}
      <div
        className="pb-4"
        style={{
          paddingBottom: 'calc(var(--tg-content-safe-area-inset-bottom, 0px) + 16px)',
        }}
      >
        <StepIndicator currentStep={currentStep} totalSteps={totalSteps} />
      </div>
    </div>
  );
};

export default Onboarding;
