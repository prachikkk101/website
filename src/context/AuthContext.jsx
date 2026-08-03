import { createContext, useState, useEffect, useContext } from 'react';
import api from '../utils/api';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  const forceLogout = (reason) => {
    localStorage.removeItem('gppms_token');
    localStorage.removeItem('gppms_refresh');
    localStorage.removeItem('gppms_session');
    setUser(null);
    if (reason) sessionStorage.setItem('gppms_revoked_msg', reason);
    window.location.href = '/login';
  };

  const refreshSession = async (customToken) => {
    const token = customToken || localStorage.getItem('gppms_token');
    if (!token) return;

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
          assignedSites: u.assignedSites ?? [],
          siteId:   u.siteId   ?? null,
          siteName: u.siteName ?? null,
          token: token,
        };

        localStorage.setItem('gppms_session', JSON.stringify(sessionObj));
        setUser(prev => {
          if (JSON.stringify(prev) === JSON.stringify(sessionObj)) return prev;
          return sessionObj;
        });
      }
    } catch (err) {
      const status = err.response?.status;
      if (status === 401 || status === 404) {
        forceLogout('Your access has been revoked. Please contact your administrator.');
      } else {
        console.warn('Failed to refresh session from backend:', err);
      }
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

  useEffect(() => {
    const token = localStorage.getItem('gppms_token');
    if (!token) return;

    const interval = setInterval(() => {
      const currentToken = localStorage.getItem('gppms_token');
      if (currentToken) {
        refreshSession(currentToken).catch(() => {});
      }
    }, 30000); // every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const login = async (email, password) => {
    if (!password || password.length < 4) {
      return { success: false, error: 'Password must be at least 4 characters.' };
    }

    try {
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
      return { success: false, error: response.data.error || 'Invalid credentials.' };
    } catch (err) {
      const isNetworkError = !err.response;
      return {
        success: false,
        error: isNetworkError
          ? 'Server is starting up. Please wait a moment and try logging in again.'
          : (err.response?.data?.error || 'Invalid email or password.'),
      };
    }
  };

  const loginWithGoogle = async (googlePayload) => {
    try {
      const response = await api.post('/auth/google', googlePayload);
      if (response.data.success) {
        const { user: u, accessToken, refreshToken } = response.data;
        const sessionObj = { ...u, token: accessToken };
        localStorage.setItem('gppms_token', accessToken);
        if (refreshToken) localStorage.setItem('gppms_refresh', refreshToken);
        localStorage.setItem('gppms_session', JSON.stringify(sessionObj));
        setUser(sessionObj);
        return { success: true, user: sessionObj };
      }
      return { success: false, error: response.data.error || 'Google login failed.' };
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.error || 'Google sign-in failed. Please try again.',
      };
    }
  };

  const registerUser = async (name, email, password) => {
    try {
      const response = await api.post('/auth/register', { name, email, password });
      if (response.data.success) {
        return {
          success: true,
          message: response.data.message || 'Registration successful! You can now sign in.',
          requiresApproval: response.data.requiresApproval || false,
        };
      }
      return { success: false, error: response.data.error || 'Registration failed.' };
    } catch (err) {
      const isNetworkError = !err.response;
      const is5xx = err.response?.status >= 500;

      if (isNetworkError || is5xx) {
        return {
          success: false,
          error: 'Cannot connect to the server. Please check your internet connection and try again.',
        };
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
    <AuthContext.Provider value={{ user, loading, login, loginWithGoogle, logout, registerUser, verifyEmail, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

