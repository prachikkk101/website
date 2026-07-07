// src/api/authService.js
import api from '../utils/api';

export const authService = {
  login: (email, password) =>
    api.post('/auth/login', { email, password }).then((r) => r.data),

  register: (name, email, password) =>
    api.post('/auth/register', { name, email, password }).then((r) => r.data),

  verifyEmail: (email, code) =>
    api.post('/auth/verify-email', { email, code }).then((r) => r.data),

  refresh: (refreshToken) =>
    api.post('/auth/refresh', { refreshToken }).then((r) => r.data),

  getMe: () =>
    api.get('/auth/me').then((r) => r.data),

  // ── Access request flow ──
  requestAccess: (data) =>
    api.post('/auth/request-access', data).then((r) => r.data),

  getAccessRequests: (status) =>
    api.get('/auth/access-requests', { params: status ? { status } : {} }).then((r) => r.data),

  approveAccess: (data) =>
    api.post('/auth/approve-access', data).then((r) => r.data),

  rejectAccess: (requestId) =>
    api.post('/auth/reject-access', { requestId }).then((r) => r.data),
};
