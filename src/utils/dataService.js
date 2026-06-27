// src/utils/dataService.js
// Single data layer for all components.
// Reads from localStorage, seeded from static files on first use.
// When the backend is connected, swap each function to call the API instead.

import { localStore } from './localStore';
import { houses as defaultHouses } from '../data/houses';
import defaultStock from '../data/stockData';
import defaultPELaying from '../data/peLaying';
import defaultICWork from '../data/icWork';

/* ═══════════════════════════════════════════
   HOUSES / PNG Connections
═══════════════════════════════════════════ */
export const getHouses = () =>
  localStore.get('houses', defaultHouses);

export const addHouse = (entry) =>
  localStore.update(
    'houses',
    (houses) => [{ ...entry, id: Date.now(), createdAt: new Date().toISOString() }, ...houses],
    defaultHouses
  );

export const updateHouse = (id, updates) =>
  localStore.update(
    'houses',
    (houses) => houses.map(h => h.id === id ? { ...h, ...updates } : h),
    defaultHouses
  );

/* ═══════════════════════════════════════════
   STOCK / Inventory
═══════════════════════════════════════════ */
export const getStock = () =>
  localStore.get('stock', defaultStock);

/**
 * challanData: { challanNo, date, site, items: [{ matIndex, qty }] }
 * matIndex is the 0-based index into the stock array.
 */
export const receiveStock = (challanData) => {
  localStore.update('stock', (stock) => {
    const updated = [...stock];
    (challanData.items || []).forEach(({ matIndex, qty }) => {
      if (qty > 0 && updated[matIndex]) {
        updated[matIndex] = {
          ...updated[matIndex],
          recv:    (updated[matIndex].recv    ?? 0) + qty,
          inStore: (updated[matIndex].inStore ?? 0) + qty,
        };
      }
    });
    return updated;
  }, defaultStock);

  // Log the challan receipt
  localStore.update('challans', (c) => [{ ...challanData, id: Date.now() }, ...c], []);
};

/**
 * materialsUsed: { "Material Name": { qty: number, unit: string }, ... }
 */
export const deductStockForHouse = (materialsUsed) => {
  if (!materialsUsed) return;
  localStore.update('stock', (stock) =>
    stock.map(item => {
      const key  = item.mat ?? item.material ?? '';
      const used = materialsUsed[key];
      if (used && used.qty > 0) {
        return {
          ...item,
          issued: (item.issued ?? 0) + used.qty,
          onSite: Math.max(0, (item.onSite ?? 0) - used.qty),
        };
      }
      return item;
    }),
    defaultStock
  );
};

/* ═══════════════════════════════════════════
   PE LAYING
═══════════════════════════════════════════ */
export const getPELaying = () =>
  localStore.get('peLaying', defaultPELaying);

export const addPELaying = (entry) =>
  localStore.update(
    'peLaying',
    (data) => [{ ...entry, sr: data.length + 1, id: Date.now() }, ...data],
    defaultPELaying
  );

/* ═══════════════════════════════════════════
   I&C WORK
═══════════════════════════════════════════ */
export const getICWork = () =>
  localStore.get('icWork', defaultICWork);

export const addICWork = (entry) =>
  localStore.update(
    'icWork',
    (data) => [{ ...entry, sr: data.length + 1, id: Date.now() }, ...data],
    defaultICWork
  );

export const updateICWork = (id, updates) =>
  localStore.update(
    'icWork',
    (data) => data.map(r => r.id === id ? { ...r, ...updates } : r),
    defaultICWork
  );

/* ═══════════════════════════════════════════
   LMC WORK (stored alongside IC in one key)
═══════════════════════════════════════════ */
export const getLMCWork = () =>
  localStore.get('lmcWork', []);

export const addLMCWork = (entry) =>
  localStore.update(
    'lmcWork',
    (data) => [{ ...entry, sr: data.length + 1, id: Date.now() }, ...data],
    []
  );

export const updateLMCWork = (id, updates) =>
  localStore.update(
    'lmcWork',
    (data) => data.map(r => r.id === id ? { ...r, ...updates } : r),
    []
  );

/* ═══════════════════════════════════════════
   AUTH — local mock bypass
═══════════════════════════════════════════ */
const ADMIN_EMAILS = [
  'admin@gppms.com',
  'oxygenhisar@gmail.com',
  'oxygenprotech@gmail.com',
];

/**
 * Returns a user object on success, null on failure.
 * Only fails when password is shorter than 4 chars.
 */
export const mockLogin = (email, password) => {
  if (!password || password.length < 4) return null;
  const role = ADMIN_EMAILS.includes(email.toLowerCase()) ? 'ADMIN' : 'SUPERVISOR';
  return {
    id:    1,
    name:  email.split('@')[0].replace(/[._]/g, ' ').toUpperCase(),
    email,
    role,
    site:  'Khanna — CA-09',
    token: 'local-' + Date.now(),
    isLocalMode: true,
  };
};

export const getSession = () => {
  try {
    return JSON.parse(localStorage.getItem('gppms_session') || 'null');
  } catch { return null; }
};
export const saveSession = (user) => {
  localStorage.setItem('gppms_session', JSON.stringify(user));
  localStorage.setItem('gppms_token', user.token || '');
};
export const clearSession = () => {
  localStorage.removeItem('gppms_session');
  localStorage.removeItem('gppms_token');
};

/* ═══════════════════════════════════════════
   DEV UTILITY — reset all local data
═══════════════════════════════════════════ */
export const resetAllLocalData = () => {
  const KEYS = ['houses', 'stock', 'peLaying', 'icWork', 'lmcWork', 'challans', 'session'];
  KEYS.forEach(k => localStorage.removeItem('gppms_' + k));
};
