// src/components/SlidePanel.jsx
import { useEffect } from 'react';

const fieldStyle = {
  width: '100%', height: 34, border: '1px solid #d1d5db', borderRadius: 5,
  padding: '0 10px', fontSize: 13, outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

const labelStyle = {
  fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block',
};

const sectionTitleStyle = {
  fontSize: 13, fontWeight: 700, color: '#1f4e1a',
  borderBottom: '1px solid #e2e8f0', paddingBottom: 6, marginBottom: 12,
};

export function SectionTitle({ children }) {
  return <div style={sectionTitleStyle}>{children}</div>;
}

export function Field({ label, required, error, children }) {
  return (
    <div>
      <label style={labelStyle}>
        {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
      </label>
      {children}
      {error && <p style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{error}</p>}
    </div>
  );
}

export function Input({ error, style, ...props }) {
  return (
    <input
      style={{
        ...fieldStyle,
        borderColor: error ? '#ef4444' : '#d1d5db',
        boxShadow: error ? '0 0 0 2px rgba(239,68,68,0.1)' : 'none',
        ...style,
      }}
      onFocus={e => { e.target.style.borderColor = error ? '#ef4444' : '#2d6a27'; e.target.style.boxShadow = '0 0 0 2px rgba(45,106,39,0.15)'; }}
      onBlur={e => { e.target.style.borderColor = error ? '#ef4444' : '#d1d5db'; e.target.style.boxShadow = error ? '0 0 0 2px rgba(239,68,68,0.1)' : 'none'; }}
      {...props}
    />
  );
}

export function Select({ error, style, children, ...props }) {
  return (
    <select
      style={{
        ...fieldStyle,
        background: '#fff',
        cursor: 'pointer',
        borderColor: error ? '#ef4444' : '#d1d5db',
        ...style,
      }}
      onFocus={e => { e.target.style.borderColor = '#2d6a27'; e.target.style.boxShadow = '0 0 0 2px rgba(45,106,39,0.15)'; }}
      onBlur={e => { e.target.style.borderColor = error ? '#ef4444' : '#d1d5db'; e.target.style.boxShadow = 'none'; }}
      {...props}
    >
      {children}
    </select>
  );
}

export function Textarea({ error, style, ...props }) {
  return (
    <textarea
      style={{
        ...fieldStyle, height: 72, padding: '8px 10px', resize: 'vertical',
        borderColor: error ? '#ef4444' : '#d1d5db',
        ...style,
      }}
      onFocus={e => { e.target.style.borderColor = '#2d6a27'; e.target.style.boxShadow = '0 0 0 2px rgba(45,106,39,0.15)'; }}
      onBlur={e => { e.target.style.borderColor = error ? '#ef4444' : '#d1d5db'; e.target.style.boxShadow = 'none'; }}
      {...props}
    />
  );
}

export default function SlidePanel({ isOpen, onClose, title, children, onSave, saving, saveLabel, extraFooter, saveDisabled }) {
  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const isBtnDisabled = saving || saveDisabled;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.45)',
          zIndex: 999,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'all' : 'none',
          transition: 'opacity 0.3s ease',
        }}
      />

      {/* Panel */}
      <div className="slide-panel" style={{
        position: 'fixed', right: 0, top: 0,
        height: '100vh', width: 480,
        background: '#fff',
        zIndex: 1000,
        display: 'flex', flexDirection: 'column',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.18)',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
      }}>
        {/* Header */}
        <div style={{
          background: '#1f4e1a', color: '#fff',
          padding: '0 20px', height: 56, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>{title}</span>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)',
              fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: '4px 6px',
              borderRadius: 4, transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: 20,
          display: 'flex', flexDirection: 'column', gap: 20,
        }}>
          {children}
        </div>

        {/* Footer */}
        {onSave && (
          <div style={{
            background: '#f8fafc', borderTop: '1px solid #e2e8f0',
            padding: '14px 20px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            flexShrink: 0, gap: 8,
          }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {extraFooter}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={onClose}
                style={{
                  border: '1px solid #d1d5db', background: '#fff', color: '#374151',
                  padding: '8px 20px', borderRadius: 5, fontSize: 13, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={onSave}
                disabled={isBtnDisabled}
                style={{
                  background: isBtnDisabled ? '#a3a3a3' : '#2d6a27', color: '#fff',
                  border: 'none', padding: '8px 24px', borderRadius: 5,
                  fontSize: 13, fontWeight: 600, cursor: isBtnDisabled ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {saving ? (
                  <>
                    <span style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.6s linear infinite' }} />
                    Saving...
                  </>
                ) : (saveLabel || 'Save Entry')}
              </button>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </>
  );
}
