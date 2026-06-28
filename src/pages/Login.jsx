import { useState, useContext, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';

const ADMIN_EMAILS = ['admin@gppms.com', 'oxygenhisar@gmail.com', 'oxygenprotech@gmail.com'];
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export default function Login() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [name,     setName]     = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [showOtp,    setShowOtp]    = useState(false);
  const [otpCode,    setOtpCode]    = useState('');

  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [focused,  setFocused]  = useState(null);
  const [showForgot, setShowForgot] = useState(false);
  const { login, registerUser, verifyEmail, user } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => { document.title = isRegister ? 'GP-PMS — Register' : 'GP-PMS — Login'; }, [isRegister]);

  if (user) {
    return <Navigate to={user.role === 'ADMIN' ? '/dashboard' : '/customers'} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    if (isRegister) {
      if (!name.trim()) {
        setError('Please enter your full name.');
        setLoading(false);
        return;
      }
      const result = await registerUser(name, email, password);
      if (result.success) {
        if (result.isLocalMode) {
          setSuccessMsg('Registration successful (Local Mode). You can now sign in!');
          setIsRegister(false);
          setName('');
        } else {
          setSuccessMsg('Registration submitted. Check your corporate email for verification OTP.');
          setShowOtp(true);
        }
      } else {
        setError(result.error || 'Registration failed. Please try again.');
      }
      setLoading(false);
    } else {
      const result = await login(email, password);
      if (result.success) {
        navigate(result.user?.role === 'ADMIN' ? '/dashboard' : '/customers', { replace: true });
      } else {
        setError(result.error || 'Login failed. Please try again.');
        setLoading(false);
      }
    }
  };

  const handleOtpVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await verifyEmail(email, otpCode);
    if (result.success) {
      setSuccessMsg('Email verified successfully! You can now sign in.');
      setShowOtp(false);
      setIsRegister(false);
      setName('');
      setOtpCode('');
    } else {
      setError(result.error || 'Verification failed. Please check the code.');
    }
    setLoading(false);
  };

  const handleGoogleSuccess = (credentialResponse) => {
    try {
      const decoded = jwtDecode(credentialResponse.credential);
      const googleUser = {
        id: decoded.sub,
        name: decoded.name,
        email: decoded.email,
        picture: decoded.picture,
        role: 'SUPERVISOR',
        siteAccess: 'none',
        token: 'local-google-' + Date.now(),
        isLocalMode: true,
      };
      localStorage.setItem('gppms_session', JSON.stringify(googleUser));
      localStorage.setItem('gppms_token',   googleUser.token);
      window.location.href = '/customers';
    } catch {
      setError('Google sign-in failed. Please try again.');
    }
  };

  const inp = (field) => ({
    width: '100%', padding: '12px 14px',
    background: '#1A2E1A',
    border: `1.5px solid ${focused === field ? '#4A7C2F' : '#2D4A2D'}`,
    borderRadius: 10, color: '#E2F0E2', fontSize: 14,
    outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s',
    boxShadow: focused === field ? '0 0 0 3px rgba(74,124,47,0.18)' : 'none',
    boxSizing: 'border-box',
  });

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0A1A0A 0%, #0F2410 40%, #0A1A0A 100%)',
      fontFamily: "'Inter','Segoe UI',system-ui,sans-serif", padding: 24,
    }}>
      {/* Background glows */}
      <div style={{ position:'fixed',top:'20%',left:'10%',width:400,height:400,background:'radial-gradient(circle,rgba(45,106,39,0.15),transparent 70%)',borderRadius:'50%',filter:'blur(60px)',pointerEvents:'none' }} />
      <div style={{ position:'fixed',bottom:'10%',right:'10%',width:350,height:350,background:'radial-gradient(circle,rgba(74,124,47,0.10),transparent 70%)',borderRadius:'50%',filter:'blur(80px)',pointerEvents:'none' }} />

      <div style={{ width:'100%',maxWidth:420,background:'linear-gradient(180deg,#112211,#0D1E0D)',borderRadius:20,border:'1px solid rgba(74,124,47,0.25)',boxShadow:'0 25px 60px rgba(0,0,0,0.5),0 0 0 1px rgba(255,255,255,0.04)',overflow:'hidden',position:'relative' }}>

        {/* Accent bar */}
        <div style={{ height:3,background:'linear-gradient(90deg,#1F4E1A,#4A7C2F,#7ec56f,#4A7C2F,#1F4E1A)' }} />

        {/* Header */}
        <div style={{ padding:'40px 40px 28px',textAlign:'center',borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          {/* TODO: Place the Oxygen Protech logo file at public/logo.png in the project root.
               The logo should be a PNG with transparent background, minimum 200x200px resolution.
               Current file: the blue triangular OP logo. */}
          <img src="/logo.png" alt="Oxygen Protech"
            style={{ width: 80, height: 80, objectFit: 'contain', borderRadius: 12, marginBottom: 18 }}
            onError={e => { e.currentTarget.style.display='none'; }}
          />
          <h1 style={{ margin:'0 0 6px',fontSize:22,fontWeight:700,color:'#E8F5E8',letterSpacing:'-0.3px' }}>Oxygen Protech Gas</h1>
          <p style={{ margin:0,fontSize:13,color:'#6A8F6A',fontWeight:500 }}>Gas Pipeline Management System</p>
        </div>

        {/* Form body */}
        <div style={{ padding:'32px 40px 36px' }}>
          {/* Sign In / Register Toggle Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 24, gap: 16 }}>
            <button
              onClick={() => { setIsRegister(false); setError(''); setSuccessMsg(''); }}
              style={{
                background: 'none', border: 'none', borderBottom: !isRegister ? '2px solid #7ec56f' : 'none',
                color: !isRegister ? '#fff' : '#6A8F6A', paddingBottom: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer'
              }}
            >
              Sign In
            </button>
            <button
              onClick={() => { setIsRegister(true); setError(''); setSuccessMsg(''); }}
              style={{
                background: 'none', border: 'none', borderBottom: isRegister ? '2px solid #7ec56f' : 'none',
                color: isRegister ? '#fff' : '#6A8F6A', paddingBottom: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer'
              }}
            >
              Register
            </button>
          </div>

          <h2 style={{ margin:'0 0 20px',fontSize:15,fontWeight:600,color:'#B5D4B5',letterSpacing:'0.2px' }}>
            {isRegister ? 'Create your new account' : 'Sign in to your account'}
          </h2>

          {error && (
            <div style={{ display:'flex',alignItems:'flex-start',gap:10,padding:'12px 14px',marginBottom:20,background:'rgba(220,53,69,0.12)',border:'1px solid rgba(220,53,69,0.3)',borderRadius:10 }}>
              <span style={{ color:'#ff6b7a',fontSize:13,lineHeight:1.5,fontWeight:500 }}>⚠ {error}</span>
            </div>
          )}

          {successMsg && (
            <div style={{ display:'flex',alignItems:'flex-start',gap:10,padding:'12px 14px',marginBottom:20,background:'rgba(34,197,94,0.12)',border:'1px solid rgba(34,197,94,0.3)',borderRadius:10 }}>
              <span style={{ color:'#4ade80',fontSize:13,lineHeight:1.5,fontWeight:500 }}>✓ {successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display:'flex',flexDirection:'column',gap:18 }}>
            {isRegister && (
              <div>
                <label style={{ display:'block',marginBottom:7,fontSize:13,fontWeight:600,color:'#8AAF8A' }}>Full Name</label>
                <input id="regName" type="text" required value={name}
                  placeholder="John Doe" onChange={e => setName(e.target.value)}
                  onFocus={() => setFocused('regName')} onBlur={() => setFocused(null)} style={inp('regName')} />
              </div>
            )}
            <div>
              <label style={{ display:'block',marginBottom:7,fontSize:13,fontWeight:600,color:'#8AAF8A' }}>Corporate Email</label>
              <input id="email" type="email" autoComplete="email" required value={email}
                placeholder="name@oxygenprotech.com" onChange={e => setEmail(e.target.value)}
                onFocus={() => setFocused('email')} onBlur={() => setFocused(null)} style={inp('email')} />
            </div>
            <div>
              <label style={{ display:'block',marginBottom:7,fontSize:13,fontWeight:600,color:'#8AAF8A' }}>Password</label>
              <input id="password" type="password" autoComplete="current-password" required value={password}
                placeholder={isRegister ? 'At least 6 characters' : 'Enter your password'} onChange={e => setPassword(e.target.value)}
                onFocus={() => setFocused('password')} onBlur={() => setFocused(null)} style={inp('password')} />
              {!isRegister && (
                <button type="button" onClick={() => setShowForgot(true)}
                  style={{ background:'none',border:'none',color:'#4A7C2F',fontSize:11,cursor:'pointer',marginTop:5,padding:0,textDecoration:'underline' }}>
                  Forgot password?
                </button>
              )}
            </div>
            <button type="submit" disabled={loading} style={{
              marginTop:8,width:'100%',padding:13,
              background: loading ? 'rgba(74,124,47,0.4)' : 'linear-gradient(135deg,#2D6A27,#4A7C2F)',
              border:'none',borderRadius:10,color: loading ? 'rgba(255,255,255,0.5)' : '#fff',
              fontSize:14,fontWeight:700,cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 4px 15px rgba(45,106,39,0.4)',
              transition:'all 0.2s',display:'flex',alignItems:'center',justifyContent:'center',gap:8,
            }}>
              {loading ? (
                <>
                  <span style={{ display:'inline-block',width:16,height:16,border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.7s linear infinite' }} />
                  Processing...
                </>
              ) : isRegister ? 'Register Account →' : 'Sign In →'}
            </button>
          </form>

          {/* Google Sign-In divider + button */}
          {!isRegister && (
            <>
              {GOOGLE_CLIENT_ID ? (
                <>
                  <div style={{ display:'flex',alignItems:'center',gap:12,margin:'20px 0' }}>
                    <div style={{ flex:1,height:1,background:'rgba(255,255,255,0.1)' }} />
                    <span style={{ fontSize:12,color:'#4A6A4A' }}>or</span>
                    <div style={{ flex:1,height:1,background:'rgba(255,255,255,0.1)' }} />
                  </div>
                  <div style={{ borderRadius:8,overflow:'hidden' }}>
                    <GoogleLogin
                      onSuccess={handleGoogleSuccess}
                      onError={() => setError('Google sign-in unavailable. Please use email login. Contact admin if this persists.')}
                      width="100%"
                      text="signin_with_google"
                      shape="rectangular"
                      theme="outline"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display:'flex',alignItems:'center',gap:12,margin:'20px 0' }}>
                    <div style={{ flex:1,height:1,background:'rgba(255,255,255,0.1)' }} />
                    <span style={{ fontSize:12,color:'#4A6A4A' }}>or</span>
                    <div style={{ flex:1,height:1,background:'rgba(255,255,255,0.1)' }} />
                  </div>
                  <button disabled style={{
                    width:'100%',padding:12,
                    background:'rgba(255,255,255,0.05)',
                    border:'1px solid rgba(255,255,255,0.12)',
                    borderRadius:8,color:'rgba(255,255,255,0.35)',
                    fontSize:13,fontWeight:600,cursor:'not-allowed',
                    opacity:0.5,
                  }}>
                    🔑 Google Sign-In (Setup Required)
                  </button>
                  <p style={{ textAlign:'center',fontSize:11,color:'#3D5C3D',marginTop:6 }}>
                    Set VITE_GOOGLE_CLIENT_ID in .env to enable
                  </p>
                </>
              )}
            </>
          )}

          <p style={{ margin:'20px 0 0',textAlign:'center',fontSize:12,color:'#4A6A4A' }}>
            {isRegister ? 'Existing supervisor? Switch to Sign In tab.' : 'Contact your administrator to get access.'}
          </p>
        </div>

        {/* Footer */}
        <div style={{ padding:'14px 40px',background:'rgba(0,0,0,0.2)',borderTop:'1px solid rgba(255,255,255,0.05)',textAlign:'center' }}>
          <p style={{ margin:0,fontSize:11,color:'#3D5C3D' }}>🔒 Secure enterprise login — activity is monitored &amp; logged</p>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: #3D5C3D; }
        input:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 1000px #1A2E1A inset !important;
          -webkit-text-fill-color: #E2F0E2 !important;
        }
      `}</style>

      {/* ── Forgot Password Modal ── */}
      {showForgot && (
        <div style={{ position:'fixed',inset:0,zIndex:2000,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',padding:24 }}>
          <div style={{ background:'#fff',borderRadius:14,width:'100%',maxWidth:400,boxShadow:'0 20px 60px rgba(0,0,0,0.4)',overflow:'hidden' }}>
            <div style={{ background:'#1f4e1a',padding:'16px 20px',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
              <span style={{ color:'#fff',fontSize:15,fontWeight:700 }}>Forgot Password?</span>
              <button onClick={() => setShowForgot(false)} style={{ background:'none',border:'none',color:'rgba(255,255,255,0.8)',fontSize:20,cursor:'pointer' }}>✕</button>
            </div>
            <div style={{ padding:24 }}>
              <p style={{ fontSize:13,color:'#475569',lineHeight:1.7,marginBottom:16 }}>
                This is an internal system. Password reset is handled by your administrator.
              </p>
              <div style={{ background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'14px 16px',marginBottom:20 }}>
                <p style={{ margin:'0 0 8px',fontSize:12,fontWeight:700,color:'#166534' }}>To regain access:</p>
                <ol style={{ margin:0,paddingLeft:18,fontSize:12,color:'#374151',lineHeight:1.8 }}>
                  <li>Contact your site administrator</li>
                  <li>Your old account will be removed</li>
                  <li>Request fresh access from the Access tab after logging in with your new credentials</li>
                </ol>
              </div>
              <p style={{ fontSize:11,color:'#94a3b8',marginBottom:20 }}>
                Your site data and entries will <strong>NOT</strong> be affected — only your login credentials change.
              </p>
              <button onClick={() => setShowForgot(false)}
                style={{ width:'100%',padding:'11px 0',background:'#2d6a27',border:'none',borderRadius:8,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer' }}>
                OK, I Understand
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── OTP Verification Modal ── */}
      {showOtp && (
        <div style={{ position:'fixed',inset:0,zIndex:2000,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',padding:24 }}>
          <div style={{ background:'#fff',borderRadius:14,width:'100%',maxWidth:400,boxShadow:'0 20px 60px rgba(0,0,0,0.4)',overflow:'hidden' }}>
            <div style={{ background:'#1f4e1a',padding:'16px 20px',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
              <span style={{ color:'#fff',fontSize:15,fontWeight:700 }}>Verify Email OTP</span>
              <button onClick={() => setShowOtp(false)} style={{ background:'none',border:'none',color:'rgba(255,255,255,0.8)',fontSize:20,cursor:'pointer' }}>✕</button>
            </div>
            <form onSubmit={handleOtpVerify} style={{ padding:24 }}>
              <p style={{ fontSize:13,color:'#475569',lineHeight:1.7,marginBottom:16 }}>
                Please enter the 6-digit verification code sent to <strong>{email}</strong>.
              </p>
              <div style={{ marginBottom:20 }}>
                <input
                  type="text" required maxLength={6} pattern="[0-9]{6}" value={otpCode}
                  placeholder="e.g. 123456" onChange={e => setOtpCode(e.target.value)}
                  style={{
                    width:'100%',padding:'12px 14px',border:'1.5px solid #d1d5db',borderRadius:10,
                    fontSize:16,textAlign:'center',letterSpacing:4,fontWeight:700,outline:'none'
                  }}
                />
              </div>
              <button type="submit" disabled={loading}
                style={{ width:'100%',padding:'12px 0',background:'#2d6a27',border:'none',borderRadius:8,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer' }}>
                {loading ? 'Verifying...' : 'Verify OTP'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
