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

// Response interceptor — silent token refresh on 401, then redirect if refresh fails
let _isRefreshing = false;
let _failedQueue = [];

function _processQueue(error, token = null) {
  _failedQueue.forEach((p) => { error ? p.reject(error) : p.resolve(token); });
  _failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (_isRefreshing) {
        return new Promise((resolve, reject) => {
          _failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }).catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      _isRefreshing = true;

      const refreshToken = localStorage.getItem('gppms_refresh');
      if (!refreshToken) {
        _processQueue(error, null);
        localStorage.removeItem('gppms_token');
        localStorage.removeItem('gppms_refresh');
        localStorage.removeItem('gppms_session');
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';
        const { data } = await axios.post(`${BASE_URL}/api/auth/refresh`, { refreshToken });
        const newToken = data.accessToken;
        localStorage.setItem('gppms_token', newToken);
        api.defaults.headers.Authorization = `Bearer ${newToken}`;
        _processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshErr) {
        _processQueue(refreshErr, null);
        localStorage.removeItem('gppms_token');
        localStorage.removeItem('gppms_refresh');
        localStorage.removeItem('gppms_session');
        window.location.href = '/login';
        return Promise.reject(refreshErr);
      } finally {
        _isRefreshing = false;
      }
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

  getHistory: (siteId, date) => {
    const params = date ? { date } : {};
    return api.get(`/sites/${siteId}/inventory/history`, { params }).then(r => r.data);
  },
};

/* ─────────────────────────────────────────────────────────────
   PNG CONNECTIONS  — /api/sites/:siteId/png-connections
───────────────────────────────────────────────────────────── */
export const pngAPI = {
  getAll: (siteId, params = {}) =>
    api.get(`/sites/${siteId}/png-connections`, { params: { limit: 500, ...params } })
      .then(r => r.data.connections || []),

  // 30s timeout: creation may include sequential stock-deduction DB calls
  create: (siteId, data) =>
    api.post(`/sites/${siteId}/png-connections`, data, { timeout: 30000 }).then(r => r.data.connection),

  update: (siteId, connectionId, data) =>
    api.patch(`/sites/${siteId}/png-connections/${connectionId}`, data).then(r => r.data.connection),

  // Hard-delete a PNG connection from Neon DB (ADMIN/SUPERVISOR only)
  delete: (siteId, connectionId) => {
    console.log('🔵 Sending delete request for PNG Connection:', connectionId, '(site:', siteId, ')');
    return api.delete(`/sites/${siteId}/png-connections/${connectionId}`)
      .then(r => {
        console.log('🟢 Delete API call succeeded for:', connectionId);
        return r.data;
      })
      .catch(err => {
        console.error('❌ Delete PNG Connection API failed:', err.response?.status, err.response?.data?.error || err.message);
        throw err;
      });
  },
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

  // Hard-delete a PE Laying record from Neon DB (ADMIN/SUPERVISOR only)
  delete: (siteId, recordId) => {
    console.log('🔵 Sending delete request for PE Laying record:', recordId, '(site:', siteId, ')');
    return api.delete(`/sites/${siteId}/pe-laying/${recordId}`)
      .then(r => {
        console.log('🟢 Delete PE Laying API succeeded for:', recordId);
        return r.data;
      })
      .catch(err => {
        console.error('❌ Delete PE Laying API failed:', err.response?.status, err.response?.data?.error || err.message);
        throw err;
      });
  },
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
   COLUMN CONFIG  — /api/sites/:siteId/column-config
   Site-wide shared column visibility and custom columns.
   Replaces per-browser localStorage so all users see the same config.
───────────────────────────────────────────────────────────── */
export const columnConfigAPI = {
  /** Fetch column config for a given table ('house' or 'pelaying') */
  get: (siteId, table) =>
    api.get(`/sites/${siteId}/column-config`, { params: { table } })
       .then(r => r.data.data || { customCols: [], hiddenCols: [] }),

  /** Persist updated column config for a table */
  update: (siteId, table, customCols, hiddenCols) =>
    api.patch(`/sites/${siteId}/column-config`, { table, customCols, hiddenCols }),
};

/* ─────────────────────────────────────────────────────────────
   LOOKUP DATA  — /api/ga-locations, /api/cities, /api/areas,
                  /api/stock-categories
   All endpoints are authenticated; data is derived from the
   Site and MaterialItem tables in the Neon database.
   Diagnostic logging (🔵 before / 🟢 after) is intentional —
   it proves data is coming from the API, not localStorage.
───────────────────────────────────────────────────────────── */
export const dataAPI = {
  /** Returns all distinct GA locations (derived from Site.gaName). */
  getGALocations: () => {
    console.log('🔵 API CALL: GET /api/ga-locations');
    return api.get('/ga-locations').then(r => {
      const data = r.data.gaLocations || [];
      console.log('🟢 API RESPONSE: /ga-locations — count:', data.length, data);
      return data;
    }).catch(err => {
      console.error('❌ API ERROR: /ga-locations', err.response?.status, err.message);
      throw err;
    });
  },

  /** Returns cities, optionally filtered by GA location. */
  getCities: (gaLocationId) => {
    const params = gaLocationId ? { gaLocationId } : {};
    console.log('🔵 API CALL: GET /api/cities', 'Params:', params);
    return api.get('/cities', { params }).then(r => {
      const data = r.data.cities || [];
      console.log('🟢 API RESPONSE: /cities — count:', data.length, data);
      return data;
    }).catch(err => {
      console.error('❌ API ERROR: /cities', err.response?.status, err.message);
      throw err;
    });
  },

  /** Returns areas, optionally filtered by city. */
  getAreas: (cityId) => {
    const params = cityId ? { cityId } : {};
    console.log('🔵 API CALL: GET /api/areas', 'Params:', params);
    return api.get('/areas', { params }).then(r => {
      const data = r.data.areas || [];
      console.log('🟢 API RESPONSE: /areas — count:', data.length, data);
      return data;
    }).catch(err => {
      console.error('❌ API ERROR: /areas', err.response?.status, err.message);
      throw err;
    });
  },

  /** Returns all distinct stock categories from MaterialItem table. */
  getStockCategories: () => {
    console.log('🔵 API CALL: GET /api/stock-categories');
    return api.get('/stock-categories').then(r => {
      const data = r.data.categories || [];
      console.log('🟢 API RESPONSE: /stock-categories — count:', data.length, data);
      return data;
    }).catch(err => {
      console.error('❌ API ERROR: /stock-categories', err.response?.status, err.message);
      throw err;
    });
  },
};

