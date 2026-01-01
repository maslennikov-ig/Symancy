/**
 * Error Boundary Component
 *
 * Catches JavaScript errors in child component tree and displays fallback UI.
 *
 * @module components/ErrorBoundary
 */
import React, { Component, ReactNode } from 'react';
import { Lang, translations } from '../lib/i18n';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  language?: Lang;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  private t = (key: keyof typeof translations.en): string => {
    const lang = this.props.language || 'ru';
    return translations[lang]?.[key] || translations.en[key] || key;
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    // TODO: Send to error tracking service (Sentry, etc.)
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const lang = this.props.language || 'ru';

      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '24px',
            textAlign: 'center',
            backgroundColor: 'var(--tg-theme-bg-color, hsl(var(--background)))',
            color: 'var(--tg-theme-text-color, hsl(var(--foreground)))',
          }}
        >
          <div
            style={{
              fontSize: '48px',
              marginBottom: '16px',
            }}
          >
            {/* Warning emoji for visual feedback */}
            {'\u26A0\uFE0F'}
          </div>
          <h2
            style={{
              fontSize: '20px',
              fontWeight: 600,
              marginBottom: '8px',
            }}
          >
            {this.t('error.boundary.title')}
          </h2>
          <p
            style={{
              fontSize: '14px',
              color: 'var(--tg-theme-hint-color, hsl(var(--muted-foreground)))',
              marginBottom: '24px',
              maxWidth: '300px',
            }}
          >
            {this.t('error.boundary.description')}
          </p>
          <button
            onClick={this.handleReload}
            style={{
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: 500,
              backgroundColor: 'var(--tg-theme-button-color, hsl(var(--primary)))',
              color: 'var(--tg-theme-button-text-color, hsl(var(--primary-foreground)))',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            {this.t('error.boundary.refresh')}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
