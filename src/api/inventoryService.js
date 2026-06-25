// src/api/inventoryService.js
import api from './api';

export const inventoryService = {
  // Daily Consumption
  getConsumptionLogs: (siteId) =>
    api.get(`/sites/${siteId}/consumption`).then((r) => r.data),

  submitConsumptionLog: (siteId, data) =>
    api.post(`/sites/${siteId}/consumption`, data).then((r) => r.data),

  // PE Returns
  getPEReturns: (siteId) =>
    api.get(`/sites/${siteId}/returns/pe`).then((r) => r.data),

  submitPEReturn: (siteId, data) =>
    api.post(`/sites/${siteId}/returns/pe`, data).then((r) => r.data),

  // GI Returns
  getGIReturns: (siteId) =>
    api.get(`/sites/${siteId}/returns/gi`).then((r) => r.data),

  submitGIReturn: (siteId, data) =>
    api.post(`/sites/${siteId}/returns/gi`, data).then((r) => r.data),

  // Tool Returns
  getToolReturns: (siteId) =>
    api.get(`/sites/${siteId}/tool-returns`).then((r) => r.data),

  submitToolReturn: (siteId, data) =>
    api.post(`/sites/${siteId}/tool-returns`, data).then((r) => r.data),
};
