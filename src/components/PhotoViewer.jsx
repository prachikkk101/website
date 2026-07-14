/**
 * PhotoViewer — shared component used by PNG Connections, PE Laying, and Inventory
 * tables to preview and download photos stored on Cloudflare R2.
 *
 * Usage:
 *   <PhotoViewer photoUrl={row.photo1Data} label="Photo 1" />
 *
 * Props:
 *   photoUrl  — R2 public URL (or null/undefined to show "—")
 *   label     — alt text + modal heading
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';

export default function PhotoViewer({ photoUrl, label = 'Photo' }) {
  const [open, setOpen] = useState(false);

  if (!photoUrl) return <span style={{ color: '#cbd5e1' }}>—</span>;

  return (
    <>
      <button
        onClick={e => { e.stopPropagation(); setOpen(true); }}
        title={`View ${label}`}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 18, lineHeight: 1, padding: 2, display: 'inline-flex',
          alignItems: 'center',
        }}
      >
        📸
      </button>

      {open && createPortal(
        /* Backdrop */
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.72)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
        >
          {/* Modal card */}
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 12,
              boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
              maxWidth: 720, width: '100%',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', borderBottom: '1px solid #e2e8f0',
            }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>
                📸 {label}
              </span>
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 20, color: '#64748b', lineHeight: 1, padding: 4,
                }}
              >✕</button>
            </div>

            {/* Image */}
            <div style={{ padding: 16, display: 'flex', justifyContent: 'center', background: '#f8fafc' }}>
              <img
                src={photoUrl}
                alt={label}
                style={{
                  maxWidth: '100%', maxHeight: '60vh',
                  objectFit: 'contain', borderRadius: 6,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                }}
                onError={e => { e.target.src = ''; e.target.alt = 'Image failed to load'; }}
              />
            </div>

            {/* Footer — Download */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
              gap: 10, padding: '12px 16px', borderTop: '1px solid #e2e8f0',
            }}>
              <a
                href={photoUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  height: 36, padding: '0 16px',
                  background: '#1f4e1a', color: '#fff',
                  borderRadius: 6, fontSize: 13, fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                ⬇ Download
              </a>
              <button
                onClick={() => setOpen(false)}
                style={{
                  height: 36, padding: '0 16px', background: '#f1f5f9',
                  border: '1px solid #e2e8f0', borderRadius: 6,
                  fontSize: 13, color: '#475569', cursor: 'pointer', fontWeight: 600,
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
