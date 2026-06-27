// src/api/peLayingService.js
import api from './api';

export const peLayingService = {
  getPELaying: (siteId) =>
    api.get(`/sites/${siteId}/pe-laying`).then((r) => r.data),

  createPELaying: (siteId, data) =>
    api.post(`/sites/${siteId}/pe-laying`, data).then((r) => r.data),

  updatePELaying: (siteId, recordId, data) =>
    api.patch(`/sites/${siteId}/pe-laying/${recordId}`, data).then((r) => r.data),
};
