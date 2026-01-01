/**
 * Processing Component (Step 3)
 *
 * Third step of the Photo Analysis flow for Telegram Mini App.
 * Shows analysis in progress with animated UI elements.
 *
 * Features:
 * - Animated coffee cup icon
 * - Dynamic status messages based on persona
 * - Progress bar with percentage
 * - Non-interruptible (no MainButton)
 * - Dark/light theme support
 *
 * @module pages/Analysis/Processing
 */
import React from 'react';
import { cn } from '../../lib/utils';
import { Persona } from '../../components/features/analysis/PersonaSelector';

/**
 * Props for Processing component
 */
interface ProcessingProps {
  /** Selected persona for personalized messages */
  persona: Persona;
  /** Progress percentage (0-100) */
  progress: number;
  /** Current status message key */
  statusKey?: string;
  /** Translation function */
  t: (key: string) => string;
  /** Optional className for container */
  className?: string;
}

/**
 * Animated Coffee Cup Icon
 */
function AnimatedCoffeeCup({ className }: { className?: string }) {
  return (
    <div className={cn('relative', className)}>
      {/* Steam animation */}
      <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex gap-1">
        <div
          className="w-1.5 h-6 bg-gradient-to-t from-muted-foreground/30 to-transparent rounded-full animate-steam-1"
          style={{ animationDelay: '0s' }}
        />
        <div
          className="w-1.5 h-8 bg-gradient-to-t from-muted-foreground/30 to-transparent rounded-full animate-steam-2"
          style={{ animationDelay: '0.3s' }}
        />
        <div
          className="w-1.5 h-6 bg-gradient-to-t from-muted-foreground/30 to-transparent rounded-full animate-steam-3"
          style={{ animationDelay: '0.6s' }}
        />
      </div>

      {/* Cup SVG */}
      <svg
        className="w-full h-full animate-gentle-float"
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Saucer */}
        <ellipse
          cx="28"
          cy="56"
          rx="24"
          ry="4"
          className="fill-muted-foreground/30"
        />

        {/* Cup body */}
        <path
          d="M8 24h40v20a12 12 0 0 1-12 12H20a12 12 0 0 1-12-12V24z"
          className="fill-primary/20 stroke-primary"
          strokeWidth="2"
        />

        {/* Cup handle */}
        <path
          d="M48 28h4a6 6 0 0 1 0 12h-4"
          className="stroke-primary"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />

        {/* Coffee liquid */}
        <path
          d="M12 28h32v16a8 8 0 0 1-8 8H20a8 8 0 0 1-8-8V28z"
          className="fill-amber-900/60"
        />

        {/* Coffee patterns (mystical symbols) */}
        <circle
          cx="22"
          cy="38"
          r="3"
          className="fill-amber-950/40 animate-pulse"
        />
        <circle
          cx="34"
          cy="36"
          r="2"
          className="fill-amber-950/40 animate-pulse"
          style={{ animationDelay: '0.5s' }}
        />
        <path
          d="M26 42c2-2 4-1 6 0"
          className="stroke-amber-950/40"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

/**
 * Processing - Analysis in progress step
 */
export function Processing({
  persona,
  progress,
  statusKey,
  t,
  className,
}: ProcessingProps) {
  // Get persona-specific message
  const personaMessage = persona === 'arina'
    ? t('analysis.processing.arinaMessage')
    : t('analysis.processing.cassandraMessage');

  // Get status text
  const statusText = statusKey ? t(statusKey) : t('analysis.processing.defaultStatus');

  // Clamp progress to 0-100
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center min-h-[calc(100vh-200px)] px-4',
        className
      )}
    >
      {/* Title */}
      <h1 className="text-xl font-bold text-foreground mb-8 text-center">
        {t('analysis.processing.title')}
      </h1>

      {/* Animated coffee cup */}
      <div className="w-32 h-40 mb-8">
        <AnimatedCoffeeCup className="w-full h-full" />
      </div>

      {/* Persona message */}
      <p className="text-center text-foreground mb-6 max-w-xs">
        {personaMessage}
      </p>

      {/* Progress bar */}
      <div className="w-full max-w-xs mb-4">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
            style={{ width: `${clampedProgress}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          <span>{statusText}</span>
          <span>{Math.round(progress)}%</span>
        </div>
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes steam-1 {
          0%, 100% { opacity: 0; transform: translateY(0) scaleY(0.8); }
          50% { opacity: 0.6; transform: translateY(-8px) scaleY(1); }
        }
        @keyframes steam-2 {
          0%, 100% { opacity: 0; transform: translateY(0) scaleY(0.8); }
          50% { opacity: 0.8; transform: translateY(-12px) scaleY(1.1); }
        }
        @keyframes steam-3 {
          0%, 100% { opacity: 0; transform: translateY(0) scaleY(0.8); }
          50% { opacity: 0.5; transform: translateY(-6px) scaleY(0.9); }
        }
        @keyframes gentle-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .animate-steam-1 { animation: steam-1 2s ease-in-out infinite; }
        .animate-steam-2 { animation: steam-2 2.5s ease-in-out infinite; }
        .animate-steam-3 { animation: steam-3 2.2s ease-in-out infinite; }
        .animate-gentle-float { animation: gentle-float 3s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

export default Processing;
