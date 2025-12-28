import React, { Component, ReactNode } from 'react';
import { translations, Lang, t as i18n_t } from '../lib/i18n';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  language?: Lang;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    // TODO: Send to error monitoring (Sentry, etc.)
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    const { language = 'en' } = this.props;
    const t = (key: keyof typeof translations.en) => i18n_t(key, language);

    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--color-background, #fff)',
          color: 'var(--color-foreground, #000)',
        }}>
          <div style={{
            textAlign: 'center',
            padding: '24px',
            maxWidth: '400px',
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '16px' }}>
              {t('error.title')}
            </h2>
            <p style={{ marginBottom: '16px', color: 'var(--color-muted-foreground, #666)' }}>
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={this.handleReload}
              style={{
                padding: '8px 16px',
                backgroundColor: 'var(--color-primary, #007bff)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {t('error.reload')}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
