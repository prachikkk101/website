// src/pages/Login.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { mockLogin, saveSession } from '../utils/dataService';

/* ──────────────────────────────────────────────
   Request Access Modal
────────────────────────────────────────────── */
function RequestAccessModal({ onClose, onSuccess }) {
  const [form, setForm]     = useState({ name: '', email: '', phone: '', siteId: '', role: 'SUPERVISOR' });
  const [sites, setSites]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [success, setSuccess] = useState(false);

  // Fetch sites (public endpoint — falls back to empty if auth-required)
  useEffect(() => {
    api.get('/sites')
      .then(r => {
        const list = Array.isArray(r.data) ? r.data : (r.data?.sites || []);
        setSites(list);
      })
      .catch(() => setSites([]));
  }, []);

  function setField(k, v) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name || !form.email || !form.phone || !form.siteId) {
      setError('Please fill in all required fields.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/request-access', {
        name:   form.name,
        email:  form.email,
        phone:  form.phone,
        siteId: form.siteId,
        role:   form.role,
      });
      setSuccess(true);
      setTimeout(() => onSuccess?.(), 1800);
    } catch (err) {
      const isNetwork = !err.response;
      setError(
        isNetwork
          ? 'Unable to connect to server. Please try again or contact your administrator.'
          : (err.response?.data?.error || 'Failed to submit request. Please try again.')
      );
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    width: '100%', height: 40, borderRadius: 8, border: '1px solid #d1d5db',
    padding: '0 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  };
  const labelStyle = { fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 };

  return (
    /* Overlay */
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 4000, padding: 16,
    }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 460,
        boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
        animation: 'slideUp 0.3s cubic-bezier(0.4,0,0.2,1)',
      }}>
        {/* Modal header */}
        <div style={{ background: '#1f4e1a', padding: '20px 24px 16px', borderRadius: '16px 16px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ color: '#fff', fontSize: 17, fontWeight: 700, margin: 0 }}>Request Site Access</h2>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, margin: '3px 0 0' }}>Submit a request — the admin will review and approve</p>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#fff', fontSize: 16, lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ padding: '20px 24px 24px' }}>
          {success ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <h3 style={{ color: '#1f4e1a', marginBottom: 8 }}>Request Submitted!</h3>
              <p style={{ color: '#64748b', fontSize: 13 }}>
                Your request has been submitted. The admin will review and approve your access.
              </p>
              <button onClick={onClose} style={{ marginTop: 16, background: '#2d6a27', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {error && (
                <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '9px 12px', borderRadius: 7, fontSize: 12, marginBottom: 14, display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                  <span>⚠️</span> <span>{error}</span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={labelStyle}>Full Name *</label>
                  <input style={inputStyle} placeholder="Ravi Sharma" value={form.name}
                    onChange={e => setField('name', e.target.value)} required
                    onFocus={e => e.target.style.borderColor = '#2d6a27'}
                    onBlur={e => e.target.style.borderColor = '#d1d5db'} />
                </div>
                <div>
                  <label style={labelStyle}>Phone Number *</label>
                  <input style={inputStyle} placeholder="9876543210" value={form.phone}
                    onChange={e => setField('phone', e.target.value)} required
                    onFocus={e => e.target.style.borderColor = '#2d6a27'}
                    onBlur={e => e.target.style.borderColor = '#d1d5db'} />
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Email Address *</label>
                <input style={inputStyle} type="email" placeholder="you@example.com" value={form.email}
                  onChange={e => setField('email', e.target.value)} required
                  onFocus={e => e.target.style.borderColor = '#2d6a27'}
                  onBlur={e => e.target.style.borderColor = '#d1d5db'} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div>
                  <label style={labelStyle}>Select Site *</label>
                  <select
                    style={{ ...inputStyle, cursor: 'pointer', background: '#fff' }}
                    value={form.siteId}
                    onChange={e => setField('siteId', e.target.value)}
                    required
                  >
                    <option value="">— Choose site —</option>
                    {sites.length > 0
                      ? sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                      : <option disabled>No sites available</option>
                    }
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Role Requested *</label>
                  <select
                    style={{ ...inputStyle, cursor: 'pointer', background: '#fff' }}
                    value={form.role}
                    onChange={e => setField('role', e.target.value)}
                  >
                    <option value="SUPERVISOR">Supervisor</option>
                    <option value="WORKER">Worker</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', height: 44, background: loading ? '#4a7c2f' : '#2d6a27',
                  color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {loading ? (
                  <>
                    <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                    Submitting...
                  </>
                ) : 'Submit Request'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Main Login Page
────────────────────────────────────────────── */
export default function Login() {
  const { loginWithMockUser } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [showModal, setShowModal]   = useState(false);

  // If already logged in, redirect immediately
  useEffect(() => {
    const session = localStorage.getItem('gppms_session');
    if (session) {
      try {
        const s = JSON.parse(session);
        if (s && s.token) {
          navigate(s.role === 'ADMIN' ? '/dashboard' : '/my-site', { replace: true });
        }
      } catch { /* ignore */ }
    }
  }, [navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      // ── 1. Try real backend first ──
      const res = await api.post('/auth/login', { email, password }, { timeout: 5000 });
      const data = res.data;
      const user = data.user || data;
      const token = data.accessToken || data.token;

      const sessionObj = { ...user, token };
      localStorage.setItem('gppms_session', JSON.stringify(sessionObj));
      localStorage.setItem('gppms_token', token);

      // Set in AuthContext
      loginWithMockUser(sessionObj);
      navigate(user.role === 'ADMIN' ? '/dashboard' : '/my-site', { replace: true });

    } catch {
      // ── 2. Backend unreachable — use local fallback ──
      const mockUser = mockLogin(email, password);
      if (mockUser) {
        saveSession(mockUser);
        loginWithMockUser(mockUser);
        navigate(mockUser.role === 'ADMIN' ? '/dashboard' : '/my-site', { replace: true });
      } else {
        setError('Password must be at least 4 characters.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1f4e1a 0%, #2d6a27 50%, #4a7c2f 100%)',
      padding: 16,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 420,
        background: '#fff',
        borderRadius: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        overflow: 'hidden',
        animation: 'slideUp 0.4s cubic-bezier(0.4,0,0.2,1)',
      }}>
        {/* Header */}
        <div style={{ background: '#1f4e1a', padding: '32px 32px 24px', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C12 2 7 8 7 13C7 15.76 9.24 18 12 18C14.76 18 17 15.76 17 13C17 8 12 2 12 2Z" fill="#7ec56f"/>
              <path d="M12 10C12 10 10 13 10 14.5C10 15.33 10.67 16 11.5 16C12.33 16 13 15.33 13 14.5C13 13 12 10 12 10Z" fill="#c0440a"/>
            </svg>
            <span style={{ color: '#fff', fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>GP-PMS</span>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, margin: 0 }}>
            Gas Pipeline Project Management System
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '28px 32px 32px' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>Welcome back</h2>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>Sign in to your account to continue</p>

          {/* Success message (after request-access submission) */}
          {successMsg && (
            <div style={{
              background: '#dcfce7', border: '1px solid #86efac', color: '#15803d',
              padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16,
              display: 'flex', alignItems: 'flex-start', gap: 8,
            }}>
              <span>✅</span> <span>{successMsg}</span>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div style={{
              background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c',
              padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16,
              display: 'flex', alignItems: 'flex-start', gap: 8,
            }}>
              <span>⚠️</span> <span>{error}</span>
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              style={{
                width: '100%', height: 42, borderRadius: 8, border: '1px solid #d1d5db',
                padding: '0 14px', fontSize: 14, outline: 'none', transition: 'border-color 0.15s',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => e.target.style.borderColor = '#2d6a27'}
              onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              style={{
                width: '100%', height: 42, borderRadius: 8, border: '1px solid #d1d5db',
                padding: '0 14px', fontSize: 14, outline: 'none', transition: 'border-color 0.15s',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => e.target.style.borderColor = '#2d6a27'}
              onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', height: 44, background: loading ? '#4a7c2f' : '#2d6a27',
              color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {loading ? (
              <>
                <div style={{
                  width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff', borderRadius: '50%',
                  animation: 'spin 0.6s linear infinite',
                }} />
                Signing in...
              </>
            ) : 'Sign In'}
          </button>

          {/* Contact admin notice */}
          <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: '#94a3b8' }}>
            Contact your administrator to get access.
          </p>

          {/* Request Access link */}
          <p style={{ textAlign: 'center', marginTop: 4, fontSize: 11, color: '#94a3b8' }}>
            New supervisor?{' '}
            <button
              type="button"
              onClick={() => { setError(''); setSuccessMsg(''); setShowModal(true); }}
              style={{ background: 'none', border: 'none', color: '#2d6a27', fontWeight: 600, fontSize: 11, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
            >
              Request access here
            </button>
          </p>
        </form>
      </div>

      {/* Request Access Modal */}
      {showModal && (
        <RequestAccessModal
          onClose={() => {
            setShowModal(false);
          }}
          onSuccess={() => {
            setShowModal(false);
            setSuccessMsg('Your request has been submitted. The admin will review and approve your access.');
          }}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
