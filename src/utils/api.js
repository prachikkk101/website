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

/* ─────────────────────────────────────────────────────────────
   STOCK / INVENTORY  — /api/sites/:siteId/inventory
───────────────────────────────────────────────────────────── */
export const stockAPI = {
  // All methods require siteId explicitly — no localStorage reads here.
  getAll: (siteId) =>
    api.get(`/sites/${siteId}/inventory`).then(r => r.data.items || []),

  receiveStock: (siteId, items) =>
    api.post(`/sites/${siteId}/inventory/receive`, { items }).then(r => r.data.items || []),

  returnStock: (siteId, items) =>
    api.post(`/sites/${siteId}/inventory/return`, { items }).then(r => r.data.items || []),

  updateItem: (siteId, material, data) =>
    api.put(`/sites/${siteId}/inventory/${encodeURIComponent(material)}`, data).then(r => r.data.item),

  deleteItem: (siteId, material) =>
    api.delete(`/sites/${siteId}/inventory/${encodeURIComponent(material)}`).then(r => r.data),
};

/* ─────────────────────────────────────────────────────────────
   PNG CONNECTIONS  — /api/sites/:siteId/png-connections
───────────────────────────────────────────────────────────── */
export const pngAPI = {
  getAll: (siteId, params = {}) =>
    api.get(`/sites/${siteId}/png-connections`, { params: { limit: 500, ...params } })
      .then(r => r.data.connections || []),

  create: (siteId, data) =>
    api.post(`/sites/${siteId}/png-connections`, data).then(r => r.data.connection),

  update: (siteId, connectionId, data) =>
    api.patch(`/sites/${siteId}/png-connections/${connectionId}`, data).then(r => r.data.connection),
};

/* ─────────────────────────────────────────────────────────────
   PE LAYING  — /api/sites/:siteId/pe-laying
───────────────────────────────────────────────────────────── */
export const peLayingAPI = {
  getAll: (siteId) =>
    api.get(`/sites/${siteId}/pe-laying`).then(r => r.data.records || []),

  create: (siteId, data) =>
    api.post(`/sites/${siteId}/pe-laying`, data).then(r => r.data.record),

  update: (siteId, recordId, data) =>
    api.patch(`/sites/${siteId}/pe-laying/${recordId}`, data).then(r => r.data.record),
};

/* ─────────────────────────────────────────────────────────────
   I&C WORK  — /api/sites/:siteId/ic
───────────────────────────────────────────────────────────── */
export const icWorkAPI = {
  getAll: (siteId) =>
    api.get(`/sites/${siteId}/ic`).then(r => r.data.records || []),

  create: (siteId, data) =>
    api.post(`/sites/${siteId}/ic`, data).then(r => r.data.record),

  update: (siteId, recordId, data) =>
    api.patch(`/sites/${siteId}/ic/${recordId}`, data).then(r => r.data.record),
};

/* ─────────────────────────────────────────────────────────────
   LOOKUP DATA  — /api/ga-locations, /api/cities, /api/areas,
                  /api/stock-categories
   All endpoints are authenticated; data is derived from the
   Site and MaterialItem tables in the Neon database.
───────────────────────────────────────────────────────────── */
export const dataAPI = {
  /** Returns all distinct GA locations (derived from Site.gaName). */
  getGALocations: () =>
    api.get('/ga-locations').then(r => r.data.gaLocations || []),

  /**
   * Returns cities for a given GA location.
   * @param {string} [gaLocationId] - filter by GA (optional)
   */
  getCities: (gaLocationId) => {
    const params = gaLocationId ? { gaLocationId } : {};
    return api.get('/cities', { params }).then(r => r.data.cities || []);
  },

  /**
   * Returns areas for a given city.
   * @param {string} [cityId] - filter by city (optional)
   */
  getAreas: (cityId) => {
    const params = cityId ? { cityId } : {};
    return api.get('/areas', { params }).then(r => r.data.areas || []);
  },

  /** Returns all distinct stock categories from MaterialItem table. */
  getStockCategories: () =>
    api.get('/stock-categories').then(r => r.data.categories || []),
};

