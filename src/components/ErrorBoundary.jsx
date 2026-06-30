// src/components/ErrorBoundary.jsx
import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    console.error('[GP-PMS] Unhandled error caught by ErrorBoundary:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, info: null });
    // Navigate to dashboard as safe fallback
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      const msg = this.state.error?.message || 'Unknown error';
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0A1A0A 0%, #0F2410 40%, #0A1A0A 100%)',
          padding: 24,
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16,
            padding: 40,
            maxWidth: 520,
            width: '100%',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>
              Something went wrong
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, margin: '0 0 24px' }}>
              {msg}
            </p>
            <button
              onClick={this.handleReset}
              style={{
                background: '#2d6a27',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '12px 28px',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Return to Dashboard
            </button>
            {process.env.NODE_ENV === 'development' && this.state.info && (
              <pre style={{
                marginTop: 24,
                textAlign: 'left',
                background: 'rgba(0,0,0,0.4)',
                padding: 12,
                borderRadius: 8,
                fontSize: 11,
                color: '#fca5a5',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
              }}>
                {this.state.info.componentStack}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
