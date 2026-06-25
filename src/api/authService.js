// src/api/authService.js
import api from './api';

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
};
