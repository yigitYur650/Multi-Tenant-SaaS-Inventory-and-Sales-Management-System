import React, { Component, ErrorInfo, ReactNode } from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

/**
 * Global Error Boundary (React Uygulaması çökmelerinde beyaz ekran yerine Fallback UI gösterir)
 */
class ErrorBoundaryComponent extends Component<Props & WithTranslation, State> {
  public state: State = {
    hasError: false,
    errorMessage: ''
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught Context Error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      const { t } = this.props;
      return (
        <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
          <h2>{t('errorBoundary.title')}</h2>
          <p>{t('errorBoundary.message')}</p>
          <pre style={{ color: 'red', marginTop: '1rem', marginBottom: '1rem' }}>
            {this.state.errorMessage}
          </pre>
          <button 
            onClick={() => window.location.reload()} 
            style={{ padding: '10px 20px', cursor: 'pointer', background: '#000', color: '#fff', border: 'none', borderRadius: '4px' }}>
            {t('errorBoundary.refreshButton')}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export const ErrorBoundary = withTranslation()(ErrorBoundaryComponent);
