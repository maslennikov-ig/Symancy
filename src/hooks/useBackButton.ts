/**
 * BackButton Hook with proper lifecycle management
 *
 * Provides a declarative way to control the Telegram WebApp BackButton
 * with automatic cleanup on unmount.
 *
 * @module hooks/useBackButton
 *
 * @example
 * ```tsx
 * function DetailPage() {
 *   const navigate = useNavigate();
 *
 *   useBackButton({
 *     visible: true,
 *     onClick: () => navigate(-1),
 *   });
 *
 *   return <div>Detail content...</div>;
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Conditional visibility based on navigation depth
 * function Page() {
 *   const { canGoBack } = useNavigation();
 *
 *   useBackButton({
 *     visible: canGoBack,
 *     onClick: goBack,
 *   });
 *
 *   return <div>Page content...</div>;
 * }
 * ```
 */
import { useEffect, useCallback, useRef } from 'react';
import { useTelegramWebApp } from './useTelegramWebApp';

/**
 * Options for configuring the BackButton
 */
export interface UseBackButtonOptions {
  /** Click handler - MUST be stable (use useCallback) */
  onClick?: () => void;
  /** Whether the button should be visible */
  visible?: boolean;
}

/**
 * Return type for useBackButton hook
 */
export interface UseBackButtonReturn {
  /** Direct access to BackButton (use with caution) */
  backButton: TelegramBackButton | undefined;
  /** Show the button */
  show: () => void;
  /** Hide the button */
  hide: () => void;
  /** Whether BackButton is available */
  isAvailable: boolean;
}

/**
 * BackButton type from TelegramWebApp
 */
type TelegramBackButton = {
  isVisible: boolean;
  onClick: (callback: () => void) => void;
  offClick: (callback: () => void) => void;
  show: () => void;
  hide: () => void;
};

/**
 * Hook for managing Telegram WebApp BackButton with proper lifecycle
 *
 * Features:
 * - Declarative configuration via options
 * - Automatic cleanup on unmount (hides button, removes handlers)
 * - Stable function references for imperative control
 * - Safe no-ops when not in Telegram WebApp
 *
 * @param options - Button configuration options
 * @returns Button controls and availability status
 */
export function useBackButton(options?: UseBackButtonOptions): UseBackButtonReturn {
  const { webApp, isWebApp } = useTelegramWebApp();

  // Store the current click handler in a ref to avoid stale closures
  const clickHandlerRef = useRef<(() => void) | undefined>(options?.onClick);

  // Update ref when onClick changes
  useEffect(() => {
    clickHandlerRef.current = options?.onClick;
  }, [options?.onClick]);

  // Main effect for button configuration and lifecycle
  useEffect(() => {
    if (!webApp?.BackButton || !isWebApp) return;

    const bb = webApp.BackButton;

    // Stable wrapper that calls the current handler from ref
    const stableClickHandler = () => {
      clickHandlerRef.current?.();
    };

    // Set up click handler (always attach the stable wrapper)
    if (options?.onClick) {
      bb.onClick(stableClickHandler);
    }

    // Show/hide based on visible prop
    if (options?.visible) {
      bb.show();
    } else {
      bb.hide();
    }

    // Cleanup: remove handler and hide button
    return () => {
      if (options?.onClick) {
        bb.offClick(stableClickHandler);
      }
      bb.hide();
    };
  }, [
    webApp,
    isWebApp,
    options?.visible,
    // Note: onClick is handled via ref, so not in deps to avoid re-registering
  ]);

  // Imperative controls with stable references
  const show = useCallback(() => {
    webApp?.BackButton?.show();
  }, [webApp]);

  const hide = useCallback(() => {
    webApp?.BackButton?.hide();
  }, [webApp]);

  return {
    backButton: webApp?.BackButton,
    show,
    hide,
    isAvailable: isWebApp && !!webApp?.BackButton,
  };
}
