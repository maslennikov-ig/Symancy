/**
 * Step Indicator Component
 *
 * A visual step progress indicator for onboarding flows.
 * Displays dots representing each step, highlighting the current step.
 *
 * @module components/features/onboarding/StepIndicator
 *
 * @example
 * ```tsx
 * <StepIndicator currentStep={2} totalSteps={4} />
 * // Renders: ○ ● ○ ○  (step 2 of 4)
 * ```
 */
import React from 'react';

/**
 * Props for the StepIndicator component
 */
export interface StepIndicatorProps {
  /** The current active step (1-indexed) */
  currentStep: number;
  /** Total number of steps in the flow */
  totalSteps: number;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * StepIndicator - Visual step progress indicator with dots
 *
 * Displays a horizontal row of dots representing steps in a flow.
 * The current step is highlighted with a filled dot, while other
 * steps show empty dots. Fully accessible with ARIA labels.
 *
 * Supports light/dark themes via Tailwind CSS variables.
 *
 * @param props - Component props
 * @returns React element displaying step indicator dots
 */
export const StepIndicator: React.FC<StepIndicatorProps> = ({
  currentStep,
  totalSteps,
  className = '',
}) => {
  // Generate array of step numbers for iteration
  const steps = Array.from({ length: totalSteps }, (_, i) => i + 1);

  return (
    <nav
      role="navigation"
      aria-label={`Step ${currentStep} of ${totalSteps}`}
      className={`flex items-center justify-center gap-2 ${className}`}
    >
      {steps.map((step) => {
        const isActive = step === currentStep;
        const isCompleted = step < currentStep;

        return (
          <span
            key={step}
            role="listitem"
            aria-label={
              isActive
                ? `Step ${step}, current`
                : isCompleted
                  ? `Step ${step}, completed`
                  : `Step ${step}, upcoming`
            }
            aria-current={isActive ? 'step' : undefined}
            className={`
              inline-block w-2.5 h-2.5 rounded-full transition-all duration-200
              ${
                isActive
                  ? 'bg-primary scale-110'
                  : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
              }
            `}
          />
        );
      })}
    </nav>
  );
};

export default StepIndicator;
