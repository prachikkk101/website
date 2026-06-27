// src/pages/Login.jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await login(email, password);
      if (data.success) {
        navigate('/dashboard', { replace: true });
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Network error';
      setError(msg);
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
        <div style={{
          background: '#1f4e1a',
          padding: '32px 32px 24px',
          textAlign: 'center',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8,
          }}>
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

          {error && (
            <div style={{
              background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c',
              padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span>⚠️</span> {error}
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
            ) : (
              'Sign In'
            )}
          </button>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#64748b' }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ color: '#2d6a27', fontWeight: 600, textDecoration: 'none' }}>
              Register here
            </Link>
          </p>
        </form>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
