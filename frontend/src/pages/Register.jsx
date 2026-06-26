import { useState, useContext } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const { register, user } = useContext(AuthContext);
  const navigate = useNavigate();

  // Already logged in — go straight to dashboard
  if (user) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await register(name, email, password);
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
      
      {/* Register Card */}
      <div style={{
        width: '100%', maxWidth: '420px',
        background: 'linear-gradient(180deg, #112211 0%, #0D1E0D 100%)',
        borderRadius: '20px',
        border: '1px solid rgba(74, 124, 47, 0.25)',
        boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 10,
      }}>

        {/* Top accent bar */}
        <div style={{
          height: '3px',
          background: 'linear-gradient(90deg, #1F4E1A, #4A7C2F, #7ec56f, #4A7C2F, #1F4E1A)',
        }} />

        {/* Header */}
        <div style={{ padding: '40px 40px 28px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h1 style={{ margin: '0 0 6px', fontSize: '22px', fontWeight: '700', color: '#E8F5E8', letterSpacing: '-0.3px' }}>
            Create an Account
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: '#6A8F6A', fontWeight: '500' }}>
            GP-PMS Portal Access
          </p>
        </div>

        {/* Form Body */}
        <div style={{ padding: '32px 40px 36px' }}>
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
            {/* Name */}
            <div>
              <label style={{ display: 'block', marginBottom: '7px', fontSize: '13px', fontWeight: '600', color: '#8AAF8A', letterSpacing: '0.1px' }}>
                Full Name
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                placeholder="John Doe"
                onChange={(e) => setName(e.target.value)}
                onFocus={() => setFocusedField('name')}
                onBlur={() => setFocusedField(null)}
                style={inputStyle('name')}
              />
            </div>

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
              <label style={{ display: 'block', marginBottom: '7px', fontSize: '13px', fontWeight: '600', color: '#8AAF8A', letterSpacing: '0.1px' }}>
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                placeholder="Create a password"
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
              {loading ? 'Validating...' : 'Register →'}
            </button>
          </form>
          
          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <span style={{ fontSize: '13px', color: '#8AAF8A' }}>Already have an account? </span>
            <Link to="/login" style={{ fontSize: '13px', color: '#4A7C2F', textDecoration: 'none', fontWeight: '600' }}>
              Sign In
            </Link>
          </div>
        </div>
      </div>
      <style>{`
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
