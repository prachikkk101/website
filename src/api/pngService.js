// src/api/pngService.js
import api from '../utils/api';

export const pngService = {
  getConnections: (siteId) =>
    api.get(`/sites/${siteId}/png-connections`).then((r) => r.data),

  createConnection: (siteId, data) =>
    api.post(`/sites/${siteId}/png-connections`, data).then((r) => r.data),

  updateConnection: (siteId, connectionId, data) =>
    api.patch(`/sites/${siteId}/png-connections/${connectionId}`, data).then((r) => r.data),

  submitMeterInstallation: (siteId, connectionId, data) =>
    api.post(`/sites/${siteId}/png-connections/${connectionId}/meter`, data).then((r) => r.data),
};
