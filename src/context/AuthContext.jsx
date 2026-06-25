// src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../api/authService';

const AuthContext = createContext({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  logout: () => {},
  register: async () => {},
  verifyEmail: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount: check if we have a valid token
  useEffect(() => {
    const token = localStorage.getItem('gp_access_token');
    const savedUser = localStorage.getItem('gp_user');

    if (token && savedUser) {
      // Validate token by calling /auth/me
      authService
        .getMe()
        .then((data) => {
          setUser(data.user);
          localStorage.setItem('gp_user', JSON.stringify(data.user));
        })
        .catch(() => {
          // Token invalid — clear everything
          localStorage.removeItem('gp_access_token');
          localStorage.removeItem('gp_refresh_token');
          localStorage.removeItem('gp_user');
          setUser(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await authService.login(email, password);
    if (data.success) {
      localStorage.setItem('gp_access_token', data.accessToken);
      localStorage.setItem('gp_refresh_token', data.refreshToken);
      localStorage.setItem('gp_user', JSON.stringify(data.user));
      setUser(data.user);
    }
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('gp_access_token');
    localStorage.removeItem('gp_refresh_token');
    localStorage.removeItem('gp_user');
    setUser(null);
  }, []);

  const register = useCallback(async (name, email, password) => {
    const data = await authService.register(name, email, password);
    return data;
  }, []);

  const verifyEmail = useCallback(async (email, code) => {
    const data = await authService.verifyEmail(email, code);
    return data;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
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
