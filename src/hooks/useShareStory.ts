/**
 * Share to Story Hook for Telegram Mini App
 *
 * Provides functionality to share analysis results to Telegram Stories.
 * Uses native Telegram WebApp shareToStory API (Bot API 7.8+).
 *
 * @module hooks/useShareStory
 */
import { useState, useCallback, useMemo } from 'react';
import { useTelegramWebApp } from './useTelegramWebApp';

/**
 * Widget link configuration for story shares
 */
interface StoryWidgetLink {
  /** URL for the widget button (deep link to app) */
  url: string;
  /** Button text (0-48 characters) */
  name: string;
}

/**
 * Options for shareToStory API
 */
interface ShareToStoryParams {
  /** Caption text for the story (0-200 characters) */
  text?: string;
  /** Widget link shown at bottom of story */
  widget_link?: StoryWidgetLink;
}

/**
 * Extended TelegramWebApp interface with shareToStory
 */
interface TelegramWebAppWithShareStory {
  shareToStory?: (mediaUrl: string, params?: ShareToStoryParams) => void;
}

/**
 * Hook return type
 */
export interface UseShareStoryReturn {
  /** Whether shareToStory is available (Bot API 7.8+) */
  isAvailable: boolean;
  /** Whether a share operation is in progress */
  isSharing: boolean;
  /** Share an analysis result to story */
  shareAnalysis: (analysisId: string, imageUrl: string) => Promise<boolean>;
  /** Share custom content to story */
  shareToStory: (mediaUrl: string, caption?: string) => Promise<boolean>;
}

/**
 * Bot username for deep links
 */
const BOT_USERNAME = 'CoffeePsychologistBot';

/**
 * Hook for sharing content to Telegram Stories
 *
 * Provides:
 * - Availability check for shareToStory API
 * - Share analysis with deep link to specific result
 * - Haptic feedback on share actions
 *
 * @returns Share story state and functions
 *
 * @example
 * ```tsx
 * function AnalysisResult({ analysisId, imageUrl }: Props) {
 *   const { isAvailable, shareAnalysis, isSharing } = useShareStory();
 *
 *   if (!isAvailable) return null;
 *
 *   return (
 *     <button
 *       onClick={() => shareAnalysis(analysisId, imageUrl)}
 *       disabled={isSharing}
 *     >
 *       {isSharing ? 'Sharing...' : 'Share to Story'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useShareStory(): UseShareStoryReturn {
  const { webApp, hapticFeedback, isWebApp } = useTelegramWebApp();
  const [isSharing, setIsSharing] = useState(false);

  // Check if shareToStory is available (Bot API 7.8+)
  const isAvailable = useMemo(() => {
    if (!isWebApp || !webApp) return false;

    const webAppWithShare = webApp as unknown as TelegramWebAppWithShareStory;
    return typeof webAppWithShare.shareToStory === 'function';
  }, [isWebApp, webApp]);

  /**
   * Share an analysis result to Telegram Story
   * Includes deep link to the specific analysis
   */
  const shareAnalysis = useCallback(
    async (analysisId: string, imageUrl: string): Promise<boolean> => {
      if (!isAvailable || !webApp) {
        console.warn('[useShareStory] shareToStory not available');
        return false;
      }

      setIsSharing(true);

      try {
        // Trigger haptic feedback for user action
        hapticFeedback.impact('medium');

        const webAppWithShare = webApp as unknown as TelegramWebAppWithShareStory;

        // Create deep link to the specific analysis
        const widgetUrl = `https://t.me/${BOT_USERNAME}/app?startapp=analysis_${analysisId}`;

        // Share to story with widget link
        webAppWithShare.shareToStory!(imageUrl, {
          text: '\u2615 My coffee analysis from @CoffeePsychologistBot',
          widget_link: {
            url: widgetUrl,
            name: 'Try it!',
          },
        });

        // Success haptic feedback
        hapticFeedback.notification('success');

        return true;
      } catch (error) {
        console.error('[useShareStory] Failed to share:', error);
        hapticFeedback.notification('error');
        return false;
      } finally {
        setIsSharing(false);
      }
    },
    [isAvailable, webApp, hapticFeedback]
  );

  /**
   * Share custom content to Telegram Story
   * For more flexible sharing scenarios
   */
  const shareToStory = useCallback(
    async (mediaUrl: string, caption?: string): Promise<boolean> => {
      if (!isAvailable || !webApp) {
        console.warn('[useShareStory] shareToStory not available');
        return false;
      }

      setIsSharing(true);

      try {
        hapticFeedback.impact('medium');

        const webAppWithShare = webApp as unknown as TelegramWebAppWithShareStory;

        // Create default widget link
        const widgetUrl = `https://t.me/${BOT_USERNAME}/app`;

        webAppWithShare.shareToStory!(mediaUrl, {
          text: caption,
          widget_link: {
            url: widgetUrl,
            name: 'Try it!',
          },
        });

        hapticFeedback.notification('success');
        return true;
      } catch (error) {
        console.error('[useShareStory] Failed to share:', error);
        hapticFeedback.notification('error');
        return false;
      } finally {
        setIsSharing(false);
      }
    },
    [isAvailable, webApp, hapticFeedback]
  );

  return {
    isAvailable,
    isSharing,
    shareAnalysis,
    shareToStory,
  };
}
