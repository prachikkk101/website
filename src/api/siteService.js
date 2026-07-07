// src/api/siteService.js
import api from '../utils/api';

export const siteService = {
  getSites: () =>
    api.get('/sites').then((r) => r.data),

  getSiteById: (id) =>
    api.get(`/sites/${id}`).then((r) => r.data),

  createSite: (data) =>
    api.post('/sites', data).then((r) => r.data),

  assignWorker: (siteId, data) =>
    api.post(`/sites/${siteId}/workers`, data).then((r) => r.data),

  getSiteStock: (siteId) =>
    api.get(`/sites/${siteId}/stock`).then((r) => r.data),

  receiveStock: (siteId, data) =>
    api.post(`/sites/${siteId}/stock/receive`, data).then((r) => r.data),
};
