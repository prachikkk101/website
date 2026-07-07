// src/api/meterService.js
import api from '../utils/api';

export const meterService = {
  getMeters: (siteId) =>
    api.get(`/sites/${siteId}/meters`).then((r) => r.data),

  receiveMeter: (siteId, data) =>
    api.post(`/sites/${siteId}/meters/receive`, data).then((r) => r.data),

  issueMeter: (siteId, data) =>
    api.post(`/sites/${siteId}/meters/issue`, data).then((r) => r.data),
};
