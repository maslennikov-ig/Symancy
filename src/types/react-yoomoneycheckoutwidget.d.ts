/**
 * Type declarations for react-yoomoneycheckoutwidget
 * This overrides the problematic source types from the npm package
 */
declare module 'react-yoomoneycheckoutwidget' {
  import { FC } from 'react';

  export interface YooWidgetProps {
    confirmation_token: string;
    return_url?: string;
    customization?: {
      modal?: boolean;
      colors?: {
        controlPrimary?: string;
        controlPrimaryContent?: string;
        controlSecondary?: string;
        background?: string;
        text?: string;
        border?: string;
      };
    };
    error_callback?: (error: { error: string }) => void;
    complete_callback?: (result: { status: string }) => void;
  }

  export const YooWidget: FC<YooWidgetProps>;
  export default YooWidget;
}

declare module 'types-yoomoneycheckoutwidget' {
  export interface YooMoneyCheckoutWidgetOptions {
    confirmation_token: string;
    return_url?: string;
    customization?: {
      modal?: boolean;
      colors?: Record<string, string>;
    };
    error_callback?: (error: { error: string }) => void;
    complete_callback?: (result: { status: string }) => void;
  }

  export class YooMoneyCheckoutWidget {
    constructor(options: YooMoneyCheckoutWidgetOptions);
    render(containerId: string): void;
    destroy(): void;
  }
}

interface Window {
  YooMoneyCheckoutWidget: typeof import('types-yoomoneycheckoutwidget').YooMoneyCheckoutWidget;
}
