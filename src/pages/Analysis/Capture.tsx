/**
 * Capture Component (Step 1)
 *
 * First step of the Photo Analysis flow for Telegram Mini App.
 * Allows users to take a photo or select from gallery.
 *
 * Features:
 * - Camera icon placeholder with instructions
 * - "Take Photo" and "From Gallery" buttons
 * - Tips for best photo quality
 * - Haptic feedback on Telegram
 * - Dark/light theme support
 *
 * @module pages/Analysis/Capture
 */
import React, { useRef } from 'react';
import { cn } from '../../lib/utils';
import { useTelegramWebApp } from '../../hooks/useTelegramWebApp';
import { CameraIcon } from '../../components/icons';

/**
 * Props for Capture component
 */
interface CaptureProps {
  /** Callback when photo is captured/selected */
  onPhotoCapture: (file: File) => void;
  /** Translation function */
  t: (key: string) => string;
  /** Optional className for container */
  className?: string;
}

/**
 * Gallery icon SVG
 */
function GalleryIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

/**
 * Capture - Photo capture/selection step
 */
export function Capture({ onPhotoCapture, t, className }: CaptureProps) {
  const { hapticFeedback, isWebApp } = useTelegramWebApp();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  /**
   * Handle file selection from either camera or gallery
   */
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Trigger success haptic feedback
      if (isWebApp) {
        hapticFeedback.notification('success');
      }
      onPhotoCapture(file);
    }
    // Reset input so same file can be selected again
    event.target.value = '';
  };

  /**
   * Open camera input
   */
  const handleTakePhoto = () => {
    if (isWebApp) {
      hapticFeedback.impact('medium');
    }
    cameraInputRef.current?.click();
  };

  /**
   * Open gallery input
   */
  const handleFromGallery = () => {
    if (isWebApp) {
      hapticFeedback.impact('light');
    }
    galleryInputRef.current?.click();
  };

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center min-h-[calc(100vh-200px)] px-4',
        className
      )}
    >
      {/* Title */}
      <h1 className="text-xl font-bold text-foreground mb-6 text-center">
        {t('analysis.capture.title')}
      </h1>

      {/* Camera placeholder with icon */}
      <div className="w-40 h-40 rounded-full bg-muted/50 border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center mb-6">
        <CameraIcon className="w-16 h-16 text-muted-foreground/50" />
      </div>

      {/* Instructions */}
      <p className="text-center text-muted-foreground mb-2">
        {t('analysis.capture.instruction')}
      </p>
      <p className="text-center text-sm text-muted-foreground/70 mb-8 max-w-xs">
        {t('analysis.capture.tip')}
      </p>

      {/* Action buttons */}
      <div className="flex flex-col gap-3 w-full max-w-xs">
        {/* Take Photo button */}
        <button
          type="button"
          onClick={handleTakePhoto}
          className={cn(
            'flex items-center justify-center gap-2 py-3 px-6 rounded-xl',
            'bg-primary text-primary-foreground font-medium',
            'hover:bg-primary/90 active:scale-[0.98]',
            'transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2'
          )}
        >
          <CameraIcon className="w-5 h-5" />
          <span>{t('analysis.capture.camera')}</span>
        </button>

        {/* From Gallery button */}
        <button
          type="button"
          onClick={handleFromGallery}
          className={cn(
            'flex items-center justify-center gap-2 py-3 px-6 rounded-xl',
            'bg-secondary text-secondary-foreground font-medium',
            'hover:bg-secondary/80 active:scale-[0.98]',
            'transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2'
          )}
        >
          <GalleryIcon className="w-5 h-5" />
          <span>{t('analysis.capture.gallery')}</span>
        </button>
      </div>

      {/* Quality tip at bottom */}
      <p className="text-xs text-muted-foreground/60 mt-8 text-center max-w-xs">
        {t('analysis.capture.lightingTip')}
      </p>

      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
        aria-label={t('analysis.capture.camera')}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        aria-label={t('analysis.capture.gallery')}
      />
    </div>
  );
}

export default Capture;
