// src/components/Toast.jsx
import React from 'react';
import { useSite } from '../context/SiteContext';

export function useToast() {
  const { showToast } = useSite();
  return { showToast };
}

export default function ToastContainer() {
  const { toasts } = useSite();

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="toast-message"
          style={{
            background: '#2d6a27',
            color: 'white',
            borderRadius: '6px',
            padding: '12px 20px',
            fontSize: '13px',
            fontWeight: 500,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            pointerEvents: 'auto',
            minWidth: '220px',
          }}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
