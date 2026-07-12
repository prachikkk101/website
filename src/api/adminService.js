// src/api/adminService.js
import api from '../utils/api';

export const adminService = {
  // Dashboard
  getDashboard: () =>
    api.get('/admin/dashboard').then((r) => r.data),

  // User management
  getUsers: () =>
    api.get('/admin/users').then((r) => r.data),

  createUser: (data) =>
    api.post('/admin/users', data).then((r) => r.data),

  updateUser: (userId, data) =>
    api.patch(`/admin/users/${userId}`, data).then((r) => r.data),

  deleteUser: (userId) =>
    api.delete(`/admin/users/${userId}`).then((r) => r.data),

  // Site access control
  restrictUser: (userId) =>
    api.patch(`/users/${userId}/restrict`).then((r) => r.data),

  restoreUser: (userId) =>
    api.patch(`/users/${userId}/restore`).then((r) => r.data),

  getSiteUsers: () =>
    api.get('/sites').then((r) => r.data),

  assignUserToSite: (siteId, data) =>
    api.post(`/sites/${siteId}/workers`, data).then((r) => r.data),

  removeSiteAssignment: (userId) =>
    api.delete(`/admin/users/${userId}/site-assignment`).then((r) => r.data),

  // Admin whitelist
  getWhitelist: () =>
    api.get('/admin/whitelist').then((r) => r.data),

  addToWhitelist: (email) =>
    api.post('/admin/whitelist', { email }).then((r) => r.data),

  removeFromWhitelist: (id) =>
    api.delete(`/admin/whitelist/${id}`).then((r) => r.data),

  // Site management
  deleteSite: (siteId) =>
    api.delete(`/sites/${siteId}`).then((r) => r.data),

  updateSite: (siteId, data) =>
    api.patch(`/sites/${siteId}`, data).then((r) => r.data),

  // Reports
  exportReport: () =>
    api.get('/admin/reports/export', { responseType: 'blob' }).then((r) => {
      const url = window.URL.createObjectURL(new Blob([r.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `GP-PMS_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    }),
};
