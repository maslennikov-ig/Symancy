/**
 * Preview Component (Step 2)
 *
 * Second step of the Photo Analysis flow for Telegram Mini App.
 * Shows the uploaded photo and allows persona selection.
 *
 * Features:
 * - Photo preview with retake button
 * - PersonaSelector for Arina/Cassandra choice
 * - Credit balance display
 * - MainButton integration for starting analysis
 * - Haptic feedback on Telegram
 * - Dark/light theme support
 *
 * @module pages/Analysis/Preview
 */
import React, { useEffect, useMemo } from 'react';
import { cn } from '../../lib/utils';
import { useTelegramWebApp } from '../../hooks/useTelegramWebApp';
import { useMainButton } from '../../hooks/useMainButton';
import { PersonaSelector, Persona } from '../../components/features/analysis/PersonaSelector';
import { RefreshIcon } from '../../components/icons';

/**
 * Credit balance for display
 */
interface CreditBalance {
  basic: number;
  pro: number;
  cassandra: number;
}

/**
 * Props for Preview component
 */
interface PreviewProps {
  /** The image file to preview */
  imageFile: File;
  /** Currently selected persona */
  selectedPersona: Persona;
  /** Callback when persona is selected */
  onPersonaSelect: (persona: Persona) => void;
  /** Callback when user wants to retake photo */
  onRetake: () => void;
  /** Callback when user starts analysis */
  onStartAnalysis: () => void;
  /** User's credit balance */
  credits: CreditBalance;
  /** Current language */
  language: 'ru' | 'en' | 'zh';
  /** Translation function */
  t: (key: string) => string;
  /** Optional className for container */
  className?: string;
}

/**
 * Preview - Photo preview and persona selection step
 */
export function Preview({
  imageFile,
  selectedPersona,
  onPersonaSelect,
  onRetake,
  onStartAnalysis,
  credits,
  language,
  t,
  className,
}: PreviewProps) {
  const { hapticFeedback, isWebApp } = useTelegramWebApp();

  // Create object URL for image preview
  const imageUrl = useMemo(() => {
    return URL.createObjectURL(imageFile);
  }, [imageFile]);

  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  /**
   * Check if user has credits for selected persona
   */
  const hasCredits = useMemo(() => {
    if (selectedPersona === 'arina') {
      // Basic analysis uses basic or pro credits
      return credits.basic > 0 || credits.pro > 0;
    }
    // Cassandra uses cassandra credits
    return credits.cassandra > 0;
  }, [selectedPersona, credits]);

  /**
   * Handle start analysis button click
   */
  const handleStartAnalysis = () => {
    if (!hasCredits) return;

    if (isWebApp) {
      hapticFeedback.impact('heavy');
    }
    onStartAnalysis();
  };

  // MainButton configuration
  useMainButton({
    text: t('analysis.preview.startAnalysis'),
    visible: true,
    disabled: !hasCredits,
    onClick: handleStartAnalysis,
  });

  /**
   * Handle retake button click
   */
  const handleRetake = () => {
    if (isWebApp) {
      hapticFeedback.impact('light');
    }
    onRetake();
  };

  return (
    <div
      className={cn(
        'flex flex-col items-center px-4 py-6',
        className
      )}
    >
      {/* Title */}
      <h1 className="text-xl font-bold text-foreground mb-4 text-center">
        {t('analysis.preview.title')}
      </h1>

      {/* Photo preview */}
      <div className="relative w-full max-w-xs mb-4">
        <div className="aspect-square rounded-2xl overflow-hidden border-2 border-border shadow-lg">
          <img
            src={imageUrl}
            alt={t('analysis.capture.title')}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Retake button overlay */}
        <button
          type="button"
          onClick={handleRetake}
          className={cn(
            'absolute bottom-3 right-3 flex items-center gap-1.5 py-2 px-3 rounded-lg',
            'bg-background/80 backdrop-blur-sm text-foreground text-sm font-medium',
            'hover:bg-background/90 active:scale-95',
            'transition-all duration-200',
            'border border-border shadow-md',
            'focus:outline-none focus:ring-2 focus:ring-primary'
          )}
          aria-label={t('analysis.preview.retake')}
        >
          <RefreshIcon className="w-4 h-4" />
          <span>{t('analysis.preview.retake')}</span>
        </button>
      </div>

      {/* Persona selector */}
      <div className="w-full max-w-xs mb-6">
        <PersonaSelector
          selectedPersona={selectedPersona}
          onSelect={onPersonaSelect}
          basicCredits={credits.basic + credits.pro}
          cassandraCredits={credits.cassandra}
          language={language}
          t={t}
        />
      </div>

      {/* Credit balance display */}
      <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
        <span>{t('analysis.preview.balance')}:</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span role="img" aria-label="Basic credits">&#x2B50;</span>
            <span className="font-medium">{credits.basic + credits.pro}</span>
          </span>
          <span className="flex items-center gap-1">
            <span role="img" aria-label="Cassandra credits">&#x1F48E;</span>
            <span className="font-medium">{credits.cassandra}</span>
          </span>
        </div>
      </div>

      {/* No credits warning */}
      {!hasCredits && (
        <p className="mt-4 text-sm text-destructive text-center">
          {t('analysis.error.noCredits')}
        </p>
      )}
    </div>
  );
}

export default Preview;
