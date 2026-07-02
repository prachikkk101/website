import axios from 'axios';

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 6000,
});

// Request interceptor to attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('gppms_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle 401s (Unauthorized)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('gppms_token');
      localStorage.removeItem('gppms_refresh');
      localStorage.removeItem('gppms_session');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

/* ── Password Reset & Change-Password helpers ── */

const BACKEND_REQUIRED_MSG =
  'This feature requires a live backend connection. Please contact your administrator.';

async function apiPost(path, body) {
  const base = import.meta.env.VITE_API_URL;
  if (!base) {
    return { success: false, error: 'Configuration error: API URL not set. Contact developer.' };
  }
  try {
    const token = localStorage.getItem('gppms_token') || '';
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error || 'Request failed' };
    return { success: true, ...data };
  } catch (err) {
    console.error('API request failed:', err);
    return { success: false, error: BACKEND_REQUIRED_MSG };
  }
}

export const adminForgotPassword = (email) =>
  apiPost('/api/auth/admin/forgot-password', { email });

export const adminVerifyResetOTP = (email, otp) =>
  apiPost('/api/auth/admin/verify-reset-otp', { email, otp });

export const adminResetPassword = (resetToken, newPassword) =>
  apiPost('/api/auth/admin/reset-password', { resetToken, newPassword });

export const changePasswordApi = (currentPassword, newPassword) =>
  apiPost('/api/auth/change-password', { currentPassword, newPassword });
