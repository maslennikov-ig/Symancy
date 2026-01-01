/**
 * MainButton Hook with proper lifecycle management
 *
 * Provides a declarative way to control the Telegram WebApp MainButton
 * with automatic cleanup on unmount.
 *
 * @module hooks/useMainButton
 *
 * @example
 * ```tsx
 * function PaymentPage() {
 *   const { showProgress, hideProgress } = useMainButton({
 *     text: 'Pay Now',
 *     visible: true,
 *     onClick: handlePayment,
 *   });
 *
 *   async function handlePayment() {
 *     showProgress();
 *     await processPayment();
 *     hideProgress();
 *   }
 *
 *   return <div>Payment form...</div>;
 * }
 * ```
 */
import { useEffect, useCallback, useRef } from 'react';
import { useTelegramWebApp } from './useTelegramWebApp';

/**
 * Options for configuring the MainButton
 */
export interface UseMainButtonOptions {
  /** Button text to display */
  text?: string;
  /** Click handler - MUST be stable (use useCallback) */
  onClick?: () => void;
  /** Whether the button should be visible */
  visible?: boolean;
  /** Whether the button should be disabled */
  disabled?: boolean;
  /** Button background color */
  color?: string;
  /** Button text color */
  textColor?: string;
}

/**
 * Return type for useMainButton hook
 */
export interface UseMainButtonReturn {
  /** Direct access to MainButton (use with caution) */
  mainButton: TelegramMainButton | undefined;
  /** Show the button */
  show: () => void;
  /** Hide the button */
  hide: () => void;
  /** Enable the button */
  enable: () => void;
  /** Disable the button */
  disable: () => void;
  /** Show loading spinner on button */
  showProgress: (leaveActive?: boolean) => void;
  /** Hide loading spinner */
  hideProgress: () => void;
  /** Whether MainButton is available */
  isAvailable: boolean;
}

/**
 * MainButton type from TelegramWebApp
 */
type TelegramMainButton = {
  text: string;
  color: string;
  textColor: string;
  isVisible: boolean;
  isActive: boolean;
  isProgressVisible: boolean;
  setText: (text: string) => void;
  onClick: (callback: () => void) => void;
  offClick: (callback: () => void) => void;
  show: () => void;
  hide: () => void;
  enable: () => void;
  disable: () => void;
  showProgress: (leaveActive?: boolean) => void;
  hideProgress: () => void;
};

/**
 * Hook for managing Telegram WebApp MainButton with proper lifecycle
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
export function useMainButton(options?: UseMainButtonOptions): UseMainButtonReturn {
  const { webApp, isWebApp } = useTelegramWebApp();

  // Store the current click handler in a ref to avoid stale closures
  const clickHandlerRef = useRef<(() => void) | undefined>(options?.onClick);

  // Update ref when onClick changes
  useEffect(() => {
    clickHandlerRef.current = options?.onClick;
  }, [options?.onClick]);

  // Main effect for button configuration and lifecycle
  useEffect(() => {
    if (!webApp?.MainButton || !isWebApp) return;

    const mb = webApp.MainButton;

    // Stable wrapper that calls the current handler from ref
    const stableClickHandler = () => {
      clickHandlerRef.current?.();
    };

    // Configure button text
    if (options?.text) {
      mb.setText(options.text);
    }

    // Configure colors
    if (options?.color) {
      mb.color = options.color;
    }

    if (options?.textColor) {
      mb.textColor = options.textColor;
    }

    // Set up click handler (always attach the stable wrapper)
    if (options?.onClick) {
      mb.onClick(stableClickHandler);
    }

    // Show/hide and enable/disable based on props
    if (options?.visible) {
      if (options?.disabled) {
        mb.disable();
      } else {
        mb.enable();
      }
      mb.show();
    } else {
      mb.hide();
    }

    // Cleanup: remove handler and hide button
    return () => {
      if (options?.onClick) {
        mb.offClick(stableClickHandler);
      }
      mb.hide();
    };
  }, [
    webApp,
    isWebApp,
    options?.text,
    options?.visible,
    options?.disabled,
    options?.color,
    options?.textColor,
    // Note: onClick is handled via ref, so not in deps to avoid re-registering
  ]);

  // Imperative controls with stable references
  const show = useCallback(() => {
    webApp?.MainButton?.show();
  }, [webApp]);

  const hide = useCallback(() => {
    webApp?.MainButton?.hide();
  }, [webApp]);

  const enable = useCallback(() => {
    webApp?.MainButton?.enable();
  }, [webApp]);

  const disable = useCallback(() => {
    webApp?.MainButton?.disable();
  }, [webApp]);

  const showProgress = useCallback((leaveActive = false) => {
    webApp?.MainButton?.showProgress(leaveActive);
  }, [webApp]);

  const hideProgress = useCallback(() => {
    webApp?.MainButton?.hideProgress();
  }, [webApp]);

  return {
    mainButton: webApp?.MainButton,
    show,
    hide,
    enable,
    disable,
    showProgress,
    hideProgress,
    isAvailable: isWebApp && !!webApp?.MainButton,
  };
}
