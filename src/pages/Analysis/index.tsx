/**
 * Analysis Flow Controller
 *
 * Main controller for the Photo Analysis flow in Telegram Mini App.
 * Orchestrates the three-step process: Capture -> Preview -> Processing.
 *
 * Flow:
 * 1. Capture: Take photo or select from gallery
 * 2. Preview: Review photo, select persona, check credits
 * 3. Processing: Show progress while analysis runs
 * 4. Complete: Navigate to /chat with analysis result
 *
 * Features:
 * - State management for flow steps
 * - BackButton integration for navigation
 * - Credit checking and consumption
 * - Error handling
 * - Haptic feedback
 *
 * @module pages/Analysis
 */
import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { cn } from '../../lib/utils';
import { useTelegramWebApp } from '../../hooks/useTelegramWebApp';
import { useBackButton } from '../../hooks/useBackButton';
import { getUserCredits } from '../../services/paymentService';
import { analyzeCoffeeCup, AnalysisError } from '../../services/analysisService';
import { consumeCredit } from '../../services/creditService';
import { Capture } from './Capture';
import { Preview } from './Preview';
import { Processing } from './Processing';
import { Persona } from '../../components/features/analysis/PersonaSelector';
import { LoaderIcon } from '../../components/icons/LoaderIcon';
import imageCompression from 'browser-image-compression';
import { translations, Lang, t as i18n_t } from '../../lib/i18n';

/**
 * Analysis flow step type
 */
type AnalysisStep = 'capture' | 'preview' | 'processing';

/**
 * Credit balance interface
 */
interface CreditBalance {
  basic: number;
  pro: number;
  cassandra: number;
}

/**
 * Props for Analysis page
 */
interface AnalysisProps {
  /** Current language */
  language: Lang;
  /** Translation function */
  t: (key: keyof typeof translations.en) => string;
}

/**
 * Analysis - Main flow controller component
 */
export function Analysis({ language, t: propT }: AnalysisProps) {
  const navigate = useNavigate();
  const { hapticFeedback, isWebApp, showAlert } = useTelegramWebApp();

  // Translation function
  const t = propT || ((key: keyof typeof translations.en) => i18n_t(key, language));

  // Flow state
  const [step, setStep] = useState<AnalysisStep>('capture');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [selectedPersona, setSelectedPersona] = useState<Persona>('arina');

  // Credit state
  const [credits, setCredits] = useState<CreditBalance>({
    basic: 0,
    pro: 0,
    cassandra: 0,
  });
  const [creditsLoading, setCreditsLoading] = useState(true);

  // Processing state
  const [progress, setProgress] = useState(0);
  const [statusKey, setStatusKey] = useState<string>('analysis.processing.defaultStatus');
  const [error, setError] = useState<string | null>(null);

  /**
   * Load user credits on mount
   */
  useEffect(() => {
    async function loadCredits() {
      setCreditsLoading(true);
      try {
        const userCredits = await getUserCredits();
        if (userCredits) {
          setCredits({
            basic: userCredits.basic_credits,
            pro: userCredits.pro_credits,
            cassandra: userCredits.cassandra_credits,
          });
        }
      } catch (err) {
        console.error('Failed to load credits:', err);
      } finally {
        setCreditsLoading(false);
      }
    }
    loadCredits();
  }, []);

  /**
   * Handle back button based on current step
   */
  const handleBack = useCallback(() => {
    if (step === 'capture') {
      // Go back to home
      navigate('/');
    } else if (step === 'preview') {
      // Go back to capture
      setStep('capture');
      setImageFile(null);
    }
    // Processing step doesn't have back button
  }, [step, navigate]);

  // BackButton configuration
  useBackButton({
    visible: step !== 'processing',
    onClick: handleBack,
  });

  /**
   * Handle photo capture from Capture step
   */
  const handlePhotoCapture = useCallback((file: File) => {
    setImageFile(file);
    setStep('preview');
    setError(null);
  }, []);

  /**
   * Handle retake from Preview step
   */
  const handleRetake = useCallback(() => {
    setImageFile(null);
    setStep('capture');
  }, []);

  /**
   * Handle persona selection
   */
  const handlePersonaSelect = useCallback((persona: Persona) => {
    setSelectedPersona(persona);
  }, []);

  /**
   * Convert file to base64
   */
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (err) => reject(err);
    });
  };

  /**
   * Start analysis process
   */
  const handleStartAnalysis = useCallback(async () => {
    if (!imageFile) return;

    setStep('processing');
    setProgress(0);
    setStatusKey('analysis.processing.preparingImage');

    try {
      // Consume credit first
      setProgress(10);
      setStatusKey('analysis.processing.checkingCredits');

      const creditType = selectedPersona === 'cassandra' ? 'cassandra' : 'basic';
      const consumeResult = await consumeCredit(creditType);

      if (!consumeResult.success) {
        throw new Error(consumeResult.error || 'Failed to consume credit');
      }

      // Compress image
      setProgress(20);
      setStatusKey('analysis.processing.compressingImage');

      const compressionOptions = {
        maxSizeMB: 0.3,
        maxWidthOrHeight: 1024,
        useWebWorker: true,
        fileType: 'image/webp' as const,
        initialQuality: 0.7,
      };

      let compressedFile = imageFile;
      try {
        compressedFile = await imageCompression(imageFile, compressionOptions);
      } catch (compressionError) {
        console.error('Image compression failed, using original:', compressionError);
      }

      // Convert to base64
      setProgress(40);
      setStatusKey('analysis.processing.uploadingImage');

      const base64Image = await fileToBase64(compressedFile);
      const dataUrlParts = base64Image.split(',');
      if (dataUrlParts.length !== 2) {
        throw new Error('Invalid base64 string format');
      }
      const mimeType = dataUrlParts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
      const imageData = dataUrlParts[1];

      // Run analysis
      setProgress(60);
      setStatusKey('analysis.processing.analyzingPatterns');

      const mode = selectedPersona === 'cassandra' ? 'esoteric' : 'psychologist';
      const result = await analyzeCoffeeCup(
        imageData,
        mimeType,
        {}, // userData - could be enhanced with user context
        mode,
        language
      );

      setProgress(100);
      setStatusKey('analysis.processing.complete');

      // Haptic success feedback
      if (isWebApp) {
        hapticFeedback.notification('success');
      }

      // Navigate to chat with result
      navigate('/chat', {
        state: {
          analysisResult: result,
          persona: selectedPersona,
          imageFile: imageFile,
        },
      });

    } catch (err) {
      console.error('Analysis failed:', err);

      // Haptic error feedback
      if (isWebApp) {
        hapticFeedback.notification('error');
      }

      // Handle error
      let errorMessage = t('error.analyzeFailed') as string;
      if (err instanceof AnalysisError) {
        errorMessage = err.message;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }

      setError(errorMessage);

      // Show alert and go back to preview
      await showAlert(errorMessage);
      setStep('preview');
      setProgress(0);
    }
  }, [imageFile, selectedPersona, language, navigate, isWebApp, hapticFeedback, showAlert, t]);

  // Loading state while fetching credits
  if (creditsLoading && step !== 'capture') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <LoaderIcon className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Render current step
  return (
    <div
      className="min-h-screen bg-background"
      style={{
        paddingTop: 'var(--tg-content-safe-area-inset-top, 0px)',
        paddingBottom: 'var(--tg-content-safe-area-inset-bottom, 0px)',
      }}
    >
      {step === 'capture' && (
        <Capture
          onPhotoCapture={handlePhotoCapture}
          t={t as (key: string) => string}
        />
      )}

      {step === 'preview' && imageFile && (
        <Preview
          imageFile={imageFile}
          selectedPersona={selectedPersona}
          onPersonaSelect={handlePersonaSelect}
          onRetake={handleRetake}
          onStartAnalysis={handleStartAnalysis}
          credits={credits}
          language={language}
          t={t as (key: string) => string}
        />
      )}

      {step === 'processing' && (
        <Processing
          persona={selectedPersona}
          progress={progress}
          statusKey={statusKey}
          t={t as (key: string) => string}
        />
      )}
    </div>
  );
}

export default Analysis;
