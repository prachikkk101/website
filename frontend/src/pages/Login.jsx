import { useState, useContext } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const { login, user } = useContext(AuthContext);
  const navigate = useNavigate();

  // Already logged in — go straight to dashboard
  if (user) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(email, password);
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error);
      setLoading(false);
    }
  };

  const inputStyle = (fieldName) => ({
    width: '100%',
    padding: '12px 14px',
    background: '#1A2E1A',
    border: `1.5px solid ${focusedField === fieldName ? '#4A7C2F' : '#2D4A2D'}`,
    borderRadius: '10px',
    color: '#E2F0E2',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxShadow: focusedField === fieldName ? '0 0 0 3px rgba(74, 124, 47, 0.18)' : 'none',
    boxSizing: 'border-box',
  });

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0A1A0A 0%, #0F2410 40%, #0A1A0A 100%)',
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      padding: '24px',
    }}>
      {/* Background glow effects */}
      <div style={{
        position: 'fixed', top: '20%', left: '10%',
        width: '400px', height: '400px',
        background: 'radial-gradient(circle, rgba(45,106,39,0.15) 0%, transparent 70%)',
        borderRadius: '50%', filter: 'blur(60px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'fixed', bottom: '10%', right: '10%',
        width: '350px', height: '350px',
        background: 'radial-gradient(circle, rgba(74,124,47,0.10) 0%, transparent 70%)',
        borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none',
      }} />

      {/* Login Card */}
      <div style={{
        width: '100%', maxWidth: '420px',
        background: 'linear-gradient(180deg, #112211 0%, #0D1E0D 100%)',
        borderRadius: '20px',
        border: '1px solid rgba(74, 124, 47, 0.25)',
        boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
        overflow: 'hidden',
        position: 'relative',
      }}>

        {/* Top accent bar */}
        <div style={{
          height: '3px',
          background: 'linear-gradient(90deg, #1F4E1A, #4A7C2F, #7ec56f, #4A7C2F, #1F4E1A)',
        }} />

        {/* Header */}
        <div style={{ padding: '40px 40px 28px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {/* Logo */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '64px', height: '64px', borderRadius: '18px',
            background: 'linear-gradient(135deg, #1F4E1A, #2D6A27)',
            boxShadow: '0 8px 20px rgba(45,106,39,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
            marginBottom: '18px',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C12 2 7 8 7 13C7 15.76 9.24 18 12 18C14.76 18 17 15.76 17 13C17 8 12 2 12 2Z" fill="#7ec56f"/>
              <path d="M12 10C12 10 10 13 10 14.5C10 15.33 10.67 16 11.5 16C12.33 16 13 15.33 13 14.5C13 13 12 10 12 10Z" fill="#F97316"/>
            </svg>
          </div>
          <h1 style={{ margin: '0 0 6px', fontSize: '22px', fontWeight: '700', color: '#E8F5E8', letterSpacing: '-0.3px' }}>
            GP-PMS Portal
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: '#6A8F6A', fontWeight: '500' }}>
            Oxygen Protech Pvt. Ltd.
          </p>
        </div>

        {/* Form Body */}
        <div style={{ padding: '32px 40px 36px' }}>
          <h2 style={{ margin: '0 0 24px', fontSize: '16px', fontWeight: '600', color: '#B5D4B5', letterSpacing: '0.2px' }}>
            Sign in to your account
          </h2>

          {error && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: '10px',
              padding: '12px 14px', marginBottom: '20px',
              background: 'rgba(220,53,69,0.12)', border: '1px solid rgba(220,53,69,0.3)',
              borderRadius: '10px',
            }}>
              <span style={{ color: '#ff6b7a', fontSize: '13px', lineHeight: '1.5', fontWeight: '500' }}>
                ⚠ {error}
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Email */}
            <div>
              <label style={{ display: 'block', marginBottom: '7px', fontSize: '13px', fontWeight: '600', color: '#8AAF8A', letterSpacing: '0.1px' }}>
                Corporate Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                placeholder="name@oxygenprotech.com"
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                style={inputStyle('email')}
              />
            </div>

            {/* Password */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '7px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#8AAF8A', letterSpacing: '0.1px' }}>
                  Password
                </label>
                <a href="#" style={{ fontSize: '12px', color: '#4A7C2F', textDecoration: 'none', fontWeight: '600' }}>
                  Forgot password?
                </a>
              </div>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                placeholder="Enter your password"
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                style={inputStyle('password')}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '8px',
                width: '100%',
                padding: '13px',
                background: loading
                  ? 'rgba(74,124,47,0.4)'
                  : 'linear-gradient(135deg, #2D6A27 0%, #4A7C2F 100%)',
                border: 'none',
                borderRadius: '10px',
                color: loading ? 'rgba(255,255,255,0.5)' : '#fff',
                fontSize: '14px',
                fontWeight: '700',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 4px 15px rgba(45,106,39,0.4)',
                letterSpacing: '0.2px',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {loading ? (
                <>
                  <span style={{
                    display: 'inline-block', width: '16px', height: '16px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: 'white', borderRadius: '50%',
                    animation: 'spin 0.7s linear infinite',
                  }} />
                  Authenticating...
                </>
              ) : (
                'Sign In →'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 40px',
          background: 'rgba(0,0,0,0.2)',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          textAlign: 'center',
        }}>
          <p style={{ margin: 0, fontSize: '11px', color: '#3D5C3D', letterSpacing: '0.2px' }}>
            🔒 Secure enterprise login — activity is monitored & logged
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: #3D5C3D; }
        input:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 1000px #1A2E1A inset !important;
          -webkit-text-fill-color: #E2F0E2 !important;
        }
        button:hover:not(:disabled) {
          filter: brightness(1.1);
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(45,106,39,0.5) !important;
        }
        button:active:not(:disabled) {
          transform: translateY(0px);
        }
      `}</style>
    </div>
  );
}
