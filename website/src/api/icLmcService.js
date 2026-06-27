// src/api/icLmcService.js
import api from './api';

export const icLmcService = {
  // I&C Work
  getICWork: (siteId) =>
    api.get(`/sites/${siteId}/ic`).then((r) => r.data),

  createICWork: (siteId, data) =>
    api.post(`/sites/${siteId}/ic`, data).then((r) => r.data),

  updateICWork: (siteId, recordId, data) =>
    api.patch(`/sites/${siteId}/ic/${recordId}`, data).then((r) => r.data),

  // LMC Work
  getLMCWork: (siteId) =>
    api.get(`/sites/${siteId}/lmc`).then((r) => r.data),

  createLMCWork: (siteId, data) =>
    api.post(`/sites/${siteId}/lmc`, data).then((r) => r.data),

  updateLMCWork: (siteId, recordId, data) =>
    api.patch(`/sites/${siteId}/lmc/${recordId}`, data).then((r) => r.data),
};
