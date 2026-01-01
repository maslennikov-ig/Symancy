/**
 * Share to Story Button Component
 *
 * Button for sharing analysis results to Telegram Stories.
 * Only renders when shareToStory API is available (Bot API 7.8+).
 *
 * @module components/features/share/ShareButton
 */
import React from 'react';
import { useShareStory } from '../../../hooks/useShareStory';
import { useTranslation, type Lang } from '../../../hooks/useTranslation';
import { Button } from '../../ui/button';
import { cn } from '../../../lib/utils';

/**
 * Share button size variants
 */
type ShareButtonSize = 'sm' | 'md' | 'lg';

/**
 * Share button props
 */
interface ShareButtonProps {
  /** Analysis ID for deep linking */
  analysisId: string;
  /** Image URL to share (must be publicly accessible HTTPS URL) */
  imageUrl: string;
  /** Current language for translations */
  language: Lang;
  /** Button size variant */
  size?: ShareButtonSize;
  /** Additional CSS classes */
  className?: string;
  /** Callback after successful share */
  onShareSuccess?: () => void;
  /** Callback after failed share */
  onShareError?: (error: Error) => void;
}

/**
 * Story icon SVG component
 */
const StoryIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Camera/story icon */}
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

/**
 * Loading spinner component
 */
const LoadingSpinner: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn('animate-spin', className)}
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

/**
 * Size class mappings
 */
const sizeClasses: Record<ShareButtonSize, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-base gap-2',
  lg: 'h-12 px-6 text-lg gap-2.5',
};

/**
 * Icon size mappings
 */
const iconSizes: Record<ShareButtonSize, string> = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

/**
 * Share to Story Button
 *
 * Renders a button for sharing analysis to Telegram Stories.
 * Automatically hides when the shareToStory API is not available.
 *
 * @example
 * ```tsx
 * <ShareButton
 *   analysisId="abc123"
 *   imageUrl="https://example.com/analysis.png"
 *   language="en"
 *   size="md"
 *   onShareSuccess={() => console.log('Shared!')}
 * />
 * ```
 */
export function ShareButton({
  analysisId,
  imageUrl,
  language,
  size = 'md',
  className,
  onShareSuccess,
  onShareError,
}: ShareButtonProps) {
  const { isAvailable, isSharing, shareAnalysis } = useShareStory();
  const { t } = useTranslation(language);

  // Don't render if not available
  if (!isAvailable) {
    return null;
  }

  const handleShare = async () => {
    try {
      const success = await shareAnalysis(analysisId, imageUrl);
      if (success) {
        onShareSuccess?.();
      } else {
        onShareError?.(new Error('Share failed'));
      }
    } catch (error) {
      onShareError?.(error instanceof Error ? error : new Error('Unknown error'));
    }
  };

  return (
    <Button
      variant="outline"
      onClick={handleShare}
      disabled={isSharing}
      className={cn(
        'inline-flex items-center justify-center font-medium',
        'border-primary/30 text-primary hover:bg-primary/10',
        'transition-all duration-200',
        sizeClasses[size],
        className
      )}
      aria-label={t('share.toStory.button')}
    >
      {isSharing ? (
        <LoadingSpinner className={iconSizes[size]} />
      ) : (
        <StoryIcon className={iconSizes[size]} />
      )}
      <span>{t('share.toStory.button')}</span>
    </Button>
  );
}

export default ShareButton;
