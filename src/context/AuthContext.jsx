// src/context/AuthContext.jsx
import {
  createContext, useContext, useState, useEffect,
  useCallback, useRef,
} from 'react';
import { authService } from '../api/authService';

const AuthContext = createContext({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  pendingRequestCount: 0,
  newAccessRequest: null,
  clearNewRequest: () => {},
  login: async () => {},
  logout: () => {},
  register: async () => {},
  verifyEmail: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser]               = useState(null);
  const [isLoading, setIsLoading]     = useState(true);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [newAccessRequest, setNewAccessRequest]       = useState(null);

  // Track previous count so we only fire popup on NEW requests
  const prevCountRef = useRef(0);
  const pollTimerRef = useRef(null);

  // ── Poll for pending access requests (admin only) ──
  const pollPendingRequests = useCallback(async (currentUser) => {
    if (!currentUser || currentUser.role !== 'ADMIN') return;
    try {
      const data = await authService.getAccessRequests('pending');
      const requests = Array.isArray(data)
        ? data
        : (data.requests || data.accessRequests || []);
      const count = requests.length;
      setPendingRequestCount(count);

      // Fire popup only if count increased
      if (count > prevCountRef.current && count > 0) {
        const latest = requests[0];
        setNewAccessRequest({
          name:     latest.name || latest.fullName || 'Someone',
          email:    latest.email || '',
          site:     latest.site?.name || latest.siteName || 'Unknown Site',
          role:     latest.role || 'Supervisor',
          id:       latest.id,
        });
      }
      prevCountRef.current = count;
    } catch {
      // Silently ignore — backend may not be running during dev
    }
  }, []);

  const startPolling = useCallback((currentUser) => {
    if (!currentUser || currentUser.role !== 'ADMIN') return;
    // Immediate first poll
    pollPendingRequests(currentUser);
    // Then every 60 seconds
    pollTimerRef.current = setInterval(() => {
      pollPendingRequests(currentUser);
    }, 60_000);
  }, [pollPendingRequests]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // ── On mount: restore session ──
  useEffect(() => {
    // Read from unified keys
    const sessionStr = localStorage.getItem('gppms_session');
    const token      = localStorage.getItem('gppms_token');

    if (sessionStr && token) {
      try {
        const saved = JSON.parse(sessionStr);

        // ── Local mode: skip backend validation ──
        if (saved.isLocalMode || token.startsWith('local-')) {
          setUser(saved);
          startPolling(saved);
          setIsLoading(false);
          return;
        }

        // ── Real backend: validate token ──
        authService
          .getMe()
          .then((data) => {
            const u = data.user;
            setUser(u);
            localStorage.setItem('gppms_session', JSON.stringify({ ...u, token }));
            startPolling(u);
          })
          .catch(() => {
            localStorage.removeItem('gppms_session');
            localStorage.removeItem('gppms_token');
            setUser(null);
          })
          .finally(() => setIsLoading(false));
        return; // don't set isLoading=false synchronously
      } catch {
        localStorage.removeItem('gppms_session');
        localStorage.removeItem('gppms_token');
      }
    }

    setIsLoading(false);
    return () => stopPolling();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Login (real backend) ──
  const login = useCallback(async (email, password) => {
    const data = await authService.login(email, password);
    if (data.success) {
      const sessionObj = { ...data.user, token: data.accessToken };
      localStorage.setItem('gppms_session', JSON.stringify(sessionObj));
      localStorage.setItem('gppms_token', data.accessToken);
      setUser(data.user);
      startPolling(data.user);
    }
    return data;
  }, [startPolling]);

  // ── Login (local mock — no backend call) ──
  const loginWithMockUser = useCallback((mockUser) => {
    localStorage.setItem('gppms_session', JSON.stringify(mockUser));
    localStorage.setItem('gppms_token', mockUser.token);
    setUser(mockUser);
    // No polling for local mode (no backend to poll)
  }, []);

  // ── Logout ──
  const logout = useCallback(() => {
    stopPolling();
    localStorage.removeItem('gppms_session');
    localStorage.removeItem('gppms_token');
    setUser(null);
    setPendingRequestCount(0);
    setNewAccessRequest(null);
    prevCountRef.current = 0;
  }, [stopPolling]);

  // ── Legacy methods kept for backward compat ──
  const register = useCallback(async (name, email, password) => {
    const data = await authService.register(name, email, password);
    return data;
  }, []);

  const verifyEmail = useCallback(async (email, code) => {
    const data = await authService.verifyEmail(email, code);
    return data;
  }, []);

  const clearNewRequest = useCallback(() => {
    setNewAccessRequest(null);
  }, []);

  // Expose a way for Masters page to refresh the count after approving/rejecting
  const refreshPendingCount = useCallback(() => {
    pollPendingRequests(user);
  }, [pollPendingRequests, user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        pendingRequestCount,
        newAccessRequest,
        clearNewRequest,
        refreshPendingCount,
        login,
        loginWithMockUser,
        logout,
        register,
        verifyEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
