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
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [focused,  setFocused]  = useState(null);
  const { login, user } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => { document.title = 'GP-PMS — Login'; }, []);

  if (user) {
    return <Navigate to={user.role === 'ADMIN' ? '/dashboard' : '/my-site'} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(email, password);
    if (result.success) {
      navigate(result.user?.role === 'ADMIN' ? '/dashboard' : '/my-site', { replace: true });
    } else {
      setError(result.error || 'Login failed. Please try again.');
      setLoading(false);
    }
  };

  const handleGoogleSuccess = (credentialResponse) => {
    try {
      const decoded = jwtDecode(credentialResponse.credential);
      const role = ADMIN_EMAILS.includes(decoded.email.toLowerCase()) ? 'ADMIN' : 'SUPERVISOR';
      const googleUser = {
        id: decoded.sub,
        name: decoded.name,
        email: decoded.email,
        picture: decoded.picture,
        role,
        site: 'Khanna — CA-09',
        token: 'local-google-' + Date.now(),
        isLocalMode: true,
      };
      localStorage.setItem('gppms_session', JSON.stringify(googleUser));
      localStorage.setItem('gppms_token',   googleUser.token);
      // Force a page reload so AuthContext picks up the new session
      window.location.href = role === 'ADMIN' ? '/dashboard' : '/my-site';
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
          <div style={{ display:'inline-flex',alignItems:'center',justifyContent:'center',width:64,height:64,borderRadius:18,background:'linear-gradient(135deg,#1F4E1A,#2D6A27)',boxShadow:'0 8px 20px rgba(45,106,39,0.4)',marginBottom:18 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C12 2 7 8 7 13C7 15.76 9.24 18 12 18C14.76 18 17 15.76 17 13C17 8 12 2 12 2Z" fill="#7ec56f"/>
              <path d="M12 10C12 10 10 13 10 14.5C10 15.33 10.67 16 11.5 16C12.33 16 13 15.33 13 14.5C13 13 12 10 12 10Z" fill="#F97316"/>
            </svg>
          </div>
          <h1 style={{ margin:'0 0 6px',fontSize:22,fontWeight:700,color:'#E8F5E8',letterSpacing:'-0.3px' }}>GP-PMS Portal</h1>
          <p style={{ margin:0,fontSize:13,color:'#6A8F6A',fontWeight:500 }}>Oxygen Protech Pvt. Ltd.</p>
        </div>

        {/* Form body */}
        <div style={{ padding:'32px 40px 36px' }}>
          <h2 style={{ margin:'0 0 24px',fontSize:16,fontWeight:600,color:'#B5D4B5',letterSpacing:'0.2px' }}>Sign in to your account</h2>

          {error && (
            <div style={{ display:'flex',alignItems:'flex-start',gap:10,padding:'12px 14px',marginBottom:20,background:'rgba(220,53,69,0.12)',border:'1px solid rgba(220,53,69,0.3)',borderRadius:10 }}>
              <span style={{ color:'#ff6b7a',fontSize:13,lineHeight:1.5,fontWeight:500 }}>⚠ {error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display:'flex',flexDirection:'column',gap:18 }}>
            <div>
              <label style={{ display:'block',marginBottom:7,fontSize:13,fontWeight:600,color:'#8AAF8A' }}>Corporate Email</label>
              <input id="email" type="email" autoComplete="email" required value={email}
                placeholder="name@oxygenprotech.com" onChange={e => setEmail(e.target.value)}
                onFocus={() => setFocused('email')} onBlur={() => setFocused(null)} style={inp('email')} />
            </div>
            <div>
              <label style={{ display:'block',marginBottom:7,fontSize:13,fontWeight:600,color:'#8AAF8A' }}>Password</label>
              <input id="password" type="password" autoComplete="current-password" required value={password}
                placeholder="Enter your password" onChange={e => setPassword(e.target.value)}
                onFocus={() => setFocused('password')} onBlur={() => setFocused(null)} style={inp('password')} />
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
                  Signing in...
                </>
              ) : 'Sign In →'}
            </button>
          </form>

          {/* Google Sign-In divider + button */}
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
                  onError={() => setError('Google sign-in failed. Use email login instead.')}
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

          <p style={{ margin:'20px 0 0',textAlign:'center',fontSize:12,color:'#4A6A4A' }}>
            Contact your administrator to get access.
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
    </div>
  );
}
