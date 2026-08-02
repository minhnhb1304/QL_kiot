import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '60vh', padding: '2rem', textAlign: 'center', color: 'var(--text-main)'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Đã xảy ra lỗi</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', maxWidth: '400px' }}>
            Ứng dụng gặp sự cố. Vui lòng tải lại trang để tiếp tục sử dụng.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '0.75rem 1.5rem', borderRadius: '12px', border: 'none',
              background: 'linear-gradient(135deg, #10B981, #059669)', color: '#fff',
              fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer'
            }}
          >
            Tải Lại Trang
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
