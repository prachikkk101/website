import { useState, useContext, useEffect, useRef } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import { adminForgotPassword, adminVerifyResetOTP, adminResetPassword } from '../utils/api';

const ADMIN_EMAILS = ['oxygenprotech@gmail.com', 'radhe.sangwan1980@gmail.com'];
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
  const [revokedMsg, setRevokedMsg] = useState('');

  // Forgot-password 3-step flow state
  const [fpStep,       setFpStep]       = useState(1); // 1 | 2 | 3
  const [fpEmail,      setFpEmail]      = useState('');
  const [fpOtp,        setFpOtp]        = useState('');
  const [fpNewPw,      setFpNewPw]      = useState('');
  const [fpConfirmPw,  setFpConfirmPw]  = useState('');
  const [fpResetToken, setFpResetToken] = useState('');
  const [fpLoading,    setFpLoading]    = useState(false);
  const [fpError,      setFpError]      = useState('');
  const [fpSuccess,    setFpSuccess]    = useState('');
  const [fpResendCd,   setFpResendCd]   = useState(0); // countdown seconds
  const resendTimer = useRef(null);

  const { login, registerUser, verifyEmail, user } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => { document.title = isRegister ? 'GP-PMS — Register' : 'GP-PMS — Login'; }, [isRegister]);

  // Show revoked-access message if admin removed this user
  useEffect(() => {
    const msg = sessionStorage.getItem('gppms_revoked_msg');
    if (msg) {
      setRevokedMsg(msg);
      sessionStorage.removeItem('gppms_revoked_msg');
    }
  }, []);


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
        // Account is auto-verified — no OTP step. Show backend message and switch to login.
        setSuccessMsg(result.message || 'Registration successful! You can now sign in.');
        setIsRegister(false);
        setName('');
        setShowOtp(false);
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

  // ── Forgot Password handlers ──
  const openForgot = () => {
    setFpStep(1); setFpEmail(''); setFpOtp(''); setFpNewPw('');
    setFpConfirmPw(''); setFpResetToken(''); setFpError(''); setFpSuccess('');
    setFpResendCd(0);
    if (resendTimer.current) clearInterval(resendTimer.current);
    setShowForgot(true);
  };
  const closeForgot = () => {
    setShowForgot(false);
    if (resendTimer.current) clearInterval(resendTimer.current);
  };

  const startResendCountdown = () => {
    setFpResendCd(30);
    if (resendTimer.current) clearInterval(resendTimer.current);
    resendTimer.current = setInterval(() => {
      setFpResendCd(cd => { if (cd <= 1) { clearInterval(resendTimer.current); return 0; } return cd - 1; });
    }, 1000);
  };

  const handleFpStep1 = async (e) => {
    e.preventDefault();
    if (!fpEmail.trim()) return;
    setFpLoading(true); setFpError('');
    const res = await adminForgotPassword(fpEmail.trim());
    setFpLoading(false);
    if (!res.success) { setFpError(res.error); return; }
    startResendCountdown();
    setFpStep(2);
  };

  const handleFpResend = async () => {
    if (fpResendCd > 0) return;
    setFpLoading(true); setFpError('');
    await adminForgotPassword(fpEmail.trim());
    setFpLoading(false);
    startResendCountdown();
  };

  const handleFpStep2 = async (e) => {
    e.preventDefault();
    if (fpOtp.length !== 6) { setFpError('Please enter the 6-digit OTP.'); return; }
    setFpLoading(true); setFpError('');
    const res = await adminVerifyResetOTP(fpEmail.trim(), fpOtp.trim());
    setFpLoading(false);
    if (!res.success) { setFpError(res.error || 'Invalid or expired OTP'); return; }
    setFpResetToken(res.resetToken);
    setFpStep(3);
  };

  const handleFpStep3 = async (e) => {
    e.preventDefault();
    setFpError('');
    if (fpNewPw.length < 8) { setFpError('Password must be at least 8 characters.'); return; }
    if (fpNewPw !== fpConfirmPw) { setFpError('Passwords do not match.'); return; }
    setFpLoading(true);
    const res = await adminResetPassword(fpResetToken, fpNewPw);
    setFpLoading(false);
    if (!res.success) { setFpError(res.error || 'Reset failed. Token may have expired.'); return; }
    setFpSuccess('Password reset successful! You can now log in.');
    setTimeout(() => { closeForgot(); setEmail(''); setPassword(''); }, 2200);
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

          {revokedMsg && (
            <div style={{ display:'flex',alignItems:'flex-start',gap:10,padding:'12px 14px',marginBottom:20,background:'rgba(220,53,69,0.18)',border:'1px solid rgba(220,53,69,0.5)',borderRadius:10 }}>
              <span style={{ fontSize:18 }}>🚫</span>
              <span style={{ color:'#ff6b7a',fontSize:13,lineHeight:1.5,fontWeight:600 }}>{revokedMsg}</span>
            </div>
          )}

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
                <button type="button" onClick={openForgot}
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

      {/* ── Forgot / Reset Password Modal (3-step OTP flow) ── */}
      {showForgot && (
        <div style={{ position:'fixed',inset:0,zIndex:2000,background:'rgba(0,0,0,0.72)',display:'flex',alignItems:'center',justifyContent:'center',padding:24 }}>
          <div style={{ background:'#fff',borderRadius:16,width:'100%',maxWidth:420,boxShadow:'0 24px 72px rgba(0,0,0,0.5)',overflow:'hidden',animation:'fadeUp 0.22s ease' }}>
            {/* Header */}
            <div style={{ background:'#1f4e1a',padding:'16px 20px',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
              <div>
                <span style={{ color:'#fff',fontSize:15,fontWeight:700 }}>
                  {fpStep === 1 ? 'Reset Admin Password' : fpStep === 2 ? 'Enter OTP' : 'Set New Password'}
                </span>
                <p style={{ margin:'2px 0 0',fontSize:11,color:'rgba(255,255,255,0.55)' }}>Admin accounts only</p>
              </div>
              <button onClick={closeForgot} style={{ background:'none',border:'none',color:'rgba(255,255,255,0.7)',fontSize:20,cursor:'pointer',lineHeight:1 }}>✕</button>
            </div>

            {/* Step dots */}
            <div style={{ display:'flex',justifyContent:'center',gap:8,padding:'12px 0 0' }}>
              {[1,2,3].map(s => (
                <div key={s} style={{
                  width: s === fpStep ? 24 : 8, height:8, borderRadius:4,
                  background: s <= fpStep ? '#2d6a27' : '#e2e8f0',
                  transition:'all 0.3s',
                }} />
              ))}
            </div>
            <p style={{ textAlign:'center',fontSize:11,color:'#94a3b8',margin:'4px 0 0' }}>Step {fpStep} of 3</p>

            {/* Body */}
            <div style={{ padding:'20px 28px 28px' }}>
              {/* Success screen */}
              {fpSuccess ? (
                <div style={{ textAlign:'center',padding:'12px 0' }}>
                  <div style={{ fontSize:42,marginBottom:12 }}>✅</div>
                  <p style={{ fontSize:15,fontWeight:700,color:'#166534',marginBottom:6 }}>{fpSuccess}</p>
                  <p style={{ fontSize:12,color:'#64748b' }}>Redirecting you to login…</p>
                </div>
              ) : (
                <>
                  {fpError && (
                    <div style={{ background:'#fef2f2',border:'1px solid #fecaca',borderRadius:8,padding:'10px 14px',marginBottom:16 }}>
                      <span style={{ color:'#dc2626',fontSize:13 }}>⚠ {fpError}</span>
                    </div>
                  )}

                  {/* STEP 1 — Email */}
                  {fpStep === 1 && (
                    <form onSubmit={handleFpStep1}>
                      <p style={{ fontSize:13,color:'#475569',marginBottom:16,lineHeight:1.6 }}>
                        Enter your admin email address and we'll send you a one-time code.
                      </p>
                      <label style={{ display:'block',fontSize:12,fontWeight:600,color:'#374151',marginBottom:6 }}>Admin Email</label>
                      <input
                        type="email" required value={fpEmail}
                        onChange={e => setFpEmail(e.target.value)}
                        placeholder="oxygenprotech@gmail.com"
                        style={{ width:'100%',padding:'11px 14px',border:'1.5px solid #d1d5db',borderRadius:9,fontSize:14,outline:'none',boxSizing:'border-box',transition:'border-color 0.2s' }}
                        onFocus={e => e.target.style.borderColor='#2d6a27'}
                        onBlur={e => e.target.style.borderColor='#d1d5db'}
                      />
                      <button type="submit" disabled={fpLoading}
                        style={{ marginTop:18,width:'100%',padding:'12px 0',background: fpLoading ? '#93c489' : '#2d6a27',border:'none',borderRadius:9,color:'#fff',fontSize:14,fontWeight:700,cursor: fpLoading ? 'not-allowed' : 'pointer',transition:'background 0.2s' }}>
                        {fpLoading ? 'Sending…' : 'Send OTP →'}
                      </button>
                    </form>
                  )}

                  {/* STEP 2 — OTP */}
                  {fpStep === 2 && (
                    <form onSubmit={handleFpStep2}>
                      <p style={{ fontSize:13,color:'#475569',marginBottom:4,lineHeight:1.6 }}>
                        Check <strong>{fpEmail}</strong> for a 6-digit code.
                      </p>
                      <p style={{ fontSize:12,color:'#94a3b8',marginBottom:20 }}>Expires in 15 minutes.</p>
                      <div style={{ display:'flex',justifyContent:'center',marginBottom:6 }}>
                        <input
                          type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                          value={fpOtp} onChange={e => setFpOtp(e.target.value.replace(/\D/g,'').slice(0,6))}
                          placeholder="• • • • • •"
                          style={{ width:200,padding:'14px 0',border:'2px solid #2d6a27',borderRadius:12,fontSize:28,fontWeight:700,textAlign:'center',letterSpacing:10,outline:'none',color:'#1f4e1a' }}
                        />
                      </div>
                      <button type="submit" disabled={fpLoading || fpOtp.length < 6}
                        style={{ marginTop:16,width:'100%',padding:'12px 0',background: (fpLoading||fpOtp.length<6) ? '#93c489' : '#2d6a27',border:'none',borderRadius:9,color:'#fff',fontSize:14,fontWeight:700,cursor:(fpLoading||fpOtp.length<6)?'not-allowed':'pointer',transition:'background 0.2s' }}>
                        {fpLoading ? 'Verifying…' : 'Verify OTP →'}
                      </button>
                      <div style={{ textAlign:'center',marginTop:14 }}>
                        <button type="button" onClick={handleFpResend} disabled={fpResendCd > 0}
                          style={{ background:'none',border:'none',fontSize:12,cursor: fpResendCd > 0 ? 'not-allowed' : 'pointer',color: fpResendCd > 0 ? '#94a3b8' : '#2d6a27',textDecoration: fpResendCd > 0 ? 'none' : 'underline' }}>
                          {fpResendCd > 0 ? `Resend OTP in ${fpResendCd}s` : "Didn't receive it? Resend OTP"}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* STEP 3 — New Password */}
                  {fpStep === 3 && (
                    <form onSubmit={handleFpStep3}>
                      <p style={{ fontSize:13,color:'#475569',marginBottom:16,lineHeight:1.6 }}>Choose a strong new password (min 8 characters).</p>
                      <label style={{ display:'block',fontSize:12,fontWeight:600,color:'#374151',marginBottom:6 }}>New Password</label>
                      <input
                        type="password" required value={fpNewPw}
                        onChange={e => setFpNewPw(e.target.value)}
                        placeholder="At least 8 characters"
                        style={{ width:'100%',padding:'11px 14px',border:`1.5px solid ${fpNewPw.length>0&&fpNewPw.length<8?'#dc2626':'#d1d5db'}`,borderRadius:9,fontSize:14,outline:'none',boxSizing:'border-box',marginBottom:4 }}
                        onFocus={e => e.target.style.borderColor='#2d6a27'}
                        onBlur={e => e.target.style.borderColor=fpNewPw.length>0&&fpNewPw.length<8?'#dc2626':'#d1d5db'}
                      />
                      <div style={{ display:'flex',gap:4,marginBottom:12 }}>
                        {[...Array(8)].map((_,i) => (
                          <div key={i} style={{ flex:1,height:3,borderRadius:2,background: fpNewPw.length > i ? (fpNewPw.length >= 8 ? '#16a34a' : '#f59e0b') : '#e2e8f0',transition:'background 0.3s' }} />
                        ))}
                      </div>
                      <label style={{ display:'block',fontSize:12,fontWeight:600,color:'#374151',marginBottom:6 }}>Confirm New Password</label>
                      <input
                        type="password" required value={fpConfirmPw}
                        onChange={e => setFpConfirmPw(e.target.value)}
                        placeholder="Repeat new password"
                        style={{ width:'100%',padding:'11px 14px',border:`1.5px solid ${fpConfirmPw.length>0&&fpConfirmPw!==fpNewPw?'#dc2626':'#d1d5db'}`,borderRadius:9,fontSize:14,outline:'none',boxSizing:'border-box',marginBottom: fpConfirmPw.length>0&&fpConfirmPw!==fpNewPw?4:18 }}
                        onFocus={e => e.target.style.borderColor='#2d6a27'}
                        onBlur={e => e.target.style.borderColor=fpConfirmPw.length>0&&fpConfirmPw!==fpNewPw?'#dc2626':'#d1d5db'}
                      />
                      {fpConfirmPw.length > 0 && fpConfirmPw !== fpNewPw && (
                        <p style={{ fontSize:11,color:'#dc2626',marginBottom:14 }}>Passwords do not match</p>
                      )}
                      <button type="submit" disabled={fpLoading}
                        style={{ width:'100%',padding:'12px 0',background: fpLoading ? '#93c489' : '#2d6a27',border:'none',borderRadius:9,color:'#fff',fontSize:14,fontWeight:700,cursor: fpLoading ? 'not-allowed' : 'pointer',transition:'background 0.2s' }}>
                        {fpLoading ? 'Resetting…' : 'Reset Password ✓'}
                      </button>
                    </form>
                  )}
                </>
              )}
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
