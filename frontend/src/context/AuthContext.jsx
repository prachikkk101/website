import { createContext, useState, useEffect } from 'react';
import api from '../utils/api';

export const AuthContext = createContext();

/* ── Hardcoded admin credentials (local / offline mode) ── */
const ADMIN_EMAILS = [
  'admin@gppms.com',
  'oxygenhisar@gmail.com',
  'oxygenprotech@gmail.com',
];

// admin@gppms.com + admin123 always works as admin.
// The two Google emails also get ADMIN in local fallback (any password).
function buildMockUser(email, password) {
  const em = email.toLowerCase();
  const isHardcodedAdmin =
    (em === 'admin@gppms.com' && password === 'admin123') ||
    ADMIN_EMAILS.includes(em);

  if (isHardcodedAdmin) {
    return {
      id: 1,
      name: em === 'admin@gppms.com' ? 'Admin' : email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
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

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('gppms_session');
      const token      = localStorage.getItem('gppms_token');
      if (storedUser && token) {
        setUser(JSON.parse(storedUser));
      }
    } catch { /* ignore */ }
    setLoading(false);
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

  const logout = () => {
    localStorage.removeItem('gppms_token');
    localStorage.removeItem('gppms_refresh');
    localStorage.removeItem('gppms_session');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
