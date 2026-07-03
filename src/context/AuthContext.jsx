import { createContext, useState, useEffect } from 'react';
import api from '../utils/api';

export const AuthContext = createContext();

/* ── Hardcoded admin credentials (local / offline mode) ── */
const ADMIN_EMAILS = [
  'oxygenprotech@gmail.com',
  'radhe.sangwan1980@gmail.com',
];

// Any email in ADMIN_EMAILS with password ≥4 chars gets ADMIN in local fallback.
function buildMockUser(email, password) {
  const em = email.toLowerCase();
  const isHardcodedAdmin = ADMIN_EMAILS.includes(em);

  if (isHardcodedAdmin) {
    return {
      id: 1,
      name: email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      email,
      role: 'ADMIN',
      siteAccess: 'all',
      token: 'local-admin-' + Date.now(),
      isLocalMode: true,
    };
  }

  // Everyone else → SUPERVISOR, view-only until approved
  return {
    id: Date.now(),
    name: email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    email,
    role: 'SUPERVISOR',
    siteAccess: 'none',
    token: 'local-' + Date.now(),
    isLocalMode: true,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = async (customToken) => {
    const token = customToken || localStorage.getItem('gppms_token');
    if (!token) return;
    if (token.startsWith('local-')) return;

    try {
      const response = await api.get('/auth/me');
      if (response.data?.success && response.data?.user) {
        const u = response.data.user;
        const role = u.role;
        const siteAccess = role === 'ADMIN'
          ? 'all'
          : (u.assignedSites && u.assignedSites.length > 0 ? u.assignedSites[0].site.name : 'none');

        const sessionObj = {
          id: u.id,
          email: u.email,
          name: u.name,
          role: role,
          siteAccess,
          siteId:   u.siteId   ?? null,
          siteName: u.siteName ?? null,
          token: token,
        };

        localStorage.setItem('gppms_session', JSON.stringify(sessionObj));
        setUser(sessionObj);
      }
    } catch (err) {
      console.warn('Failed to refresh session from backend:', err);
    }
  };

  useEffect(() => {
    async function initAuth() {
      try {
        const storedUser = localStorage.getItem('gppms_session');
        const token      = localStorage.getItem('gppms_token');
        if (storedUser && token) {
          setUser(JSON.parse(storedUser));
          await refreshSession(token);
        }
      } catch { /* ignore */ }
      setLoading(false);
    }
    initAuth();
  }, []);

  const login = async (email, password) => {
    // Basic client-side validation
    if (!password || password.length < 4) {
      return { success: false, error: 'Password must be at least 4 characters.' };
    }

    try {
      // ── 1. Try real backend ──
      const response = await api.post('/auth/login', { email, password });
      if (response.data.success) {
        const { user: u, accessToken, refreshToken } = response.data;
        const sessionObj = { ...u, token: accessToken };
        localStorage.setItem('gppms_token', accessToken);
        if (refreshToken) localStorage.setItem('gppms_refresh', refreshToken);
        localStorage.setItem('gppms_session', JSON.stringify(sessionObj));
        setUser(sessionObj);
        return { success: true, user: sessionObj };
      }
      // Backend responded but said login failed (wrong password etc.)
      return { success: false, error: response.data.error || 'Invalid credentials.' };
    } catch (err) {
      // ── 2. Network/502 error — fall back to local mode ──
      const isNetworkError = !err.response;
      const is5xx = err.response?.status >= 500;

      if (isNetworkError || is5xx) {
        // Silent local fallback — check hardcoded admin creds first
        const mockUser = buildMockUser(email, password);
        localStorage.setItem('gppms_token', mockUser.token);
        localStorage.setItem('gppms_session', JSON.stringify(mockUser));
        setUser(mockUser);
        return { success: true, user: mockUser };
      }

      // Backend is reachable but returned 4xx (wrong credentials)
      return {
        success: false,
        error: err.response?.data?.error || 'Invalid email or password.',
      };
    }
  };

  const registerUser = async (name, email, password) => {
    try {
      // ── 1. Try real backend ──
      const response = await api.post('/auth/register', { name, email, password });
      if (response.data.success) {
        return { success: true, message: response.data.message || 'OTP sent to email.' };
      }
      return { success: false, error: response.data.error || 'Registration failed.' };
    } catch (err) {
      // ── 2. Network/502 error — fall back to local mode ──
      const isNetworkError = !err.response;
      const is5xx = err.response?.status >= 500;

      if (isNetworkError || is5xx) {
        // Save user locally in gppms_users registry
        try {
          const localUsers = JSON.parse(localStorage.getItem('gppms_users') || '[]');
          if (localUsers.some(u => u.email.toLowerCase() === email.toLowerCase())) {
            return { success: false, error: 'Email already registered.' };
          }
          const newUser = {
            id: Date.now(),
            name,
            email,
            role: 'SUPERVISOR',
            siteAccess: 'none',
            createdAt: new Date().toISOString(),
          };
          localUsers.push(newUser);
          localStorage.setItem('gppms_users', JSON.stringify(localUsers));
        } catch (e) { console.error('Local register error:', e); }

        return { success: true, isLocalMode: true, message: 'Registration successful (Local Mode).' };
      }

      return {
        success: false,
        error: err.response?.data?.error || 'Registration failed.',
      };
    }
  };

  const verifyEmail = async (email, code) => {
    try {
      const response = await api.post('/auth/verify-email', { email, code });
      if (response.data.success) {
        return { success: true };
      }
      return { success: false, error: response.data.error || 'Verification failed.' };
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.error || 'Verification failed.',
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('gppms_token');
    localStorage.removeItem('gppms_refresh');
    localStorage.removeItem('gppms_session');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, registerUser, verifyEmail, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}
