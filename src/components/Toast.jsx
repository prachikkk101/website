// src/components/Toast.jsx
import { useState, useCallback, useRef } from 'react';

let _showToast = null;

/* Internal component — mount once in App or Layout */
export function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  // Register the global trigger
  _showToast = useCallback((message, type = 'success') => {
    const id = ++idRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3200);
  }, []);

  return (
    <div style={{
      position: 'fixed', top: 20, right: 20, zIndex: 2000,
      display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <div
          key={t.id}
          style={{
            background: t.type === 'error' ? '#dc2626' : '#2d6a27',
            color: '#fff',
            borderRadius: 6,
            padding: '12px 20px',
            fontSize: 13,
            fontWeight: 500,
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            animation: 'toastIn 0.25s ease forwards',
            display: 'flex', alignItems: 'center', gap: 8,
            minWidth: 220,
          }}
        >
          <span>{t.type === 'error' ? '⚠' : '✓'}</span>
          {t.message}
        </div>
      ))}
      <style>{`
        @keyframes toastIn {
          from { opacity:0; transform: translateX(40px); }
          to   { opacity:1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

/* Hook used in any component */
export function useToast() {
  const showToast = useCallback((message, type = 'success') => {
    if (_showToast) _showToast(message, type);
  }, []);
  return { showToast };
}
