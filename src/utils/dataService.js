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

export const receiveStock = (materialNameOrChallan, receivedQty) => {
  if (typeof materialNameOrChallan === 'object') {
    const challanData = materialNameOrChallan;
    localStore.update('stock', (stock) => {
      const updated = [...stock];
      (challanData.items || []).forEach(({ matIndex, qty }) => {
        if (qty > 0 && updated[matIndex]) {
          const item = updated[matIndex];
          const oldReturned = item.returned !== undefined ? item.returned : (item.ret || 0);
          const oldReceived = item.received !== undefined ? item.received : (item.recv || 0);
          const oldUsed = item.used !== undefined ? item.used : (item.issued || 0);

          const newReceived = oldReceived + qty;
          const newAvailable = newReceived - oldUsed - oldReturned;
          const clampedAvailable = Math.max(0, newAvailable);

          updated[matIndex] = {
            ...item,
            recv: newReceived,
            received: newReceived,
            inStore: clampedAvailable,
            available: clampedAvailable,
          };
        }
      });
      return updated;
    }, defaultStock);
    localStore.update('challans', (c) => [{ ...challanData, id: Date.now() }, ...c], []);
    return;
  }

  const materialName = materialNameOrChallan;
  localStore.update('stock', (stock) => {
    return stock.map(item => {
      if (item.mat === materialName || item.material === materialName || item.name === materialName) {
        const oldReturned = item.returned !== undefined ? item.returned : (item.ret || 0);
        const oldReceived = item.received !== undefined ? item.received : (item.recv || 0);
        const oldUsed = item.used !== undefined ? item.used : (item.issued || 0);

        const newReceived = oldReceived + receivedQty;
        const newAvailable = newReceived - oldUsed - oldReturned;
        const clampedAvailable = Math.max(0, newAvailable);

        return {
          ...item,
          received: newReceived,
          recv: newReceived,
          available: clampedAvailable,
          inStore: clampedAvailable
        };
      }
      return item;
    });
  }, defaultStock);
};

export const processReturn = (materialName, returnedQty) => {
  localStore.update('stock', (stock) => {
    return stock.map(item => {
      if (item.mat === materialName || item.material === materialName || item.name === materialName) {
        const oldReturned = item.returned !== undefined ? item.returned : (item.ret || 0);
        const oldReceived = item.received !== undefined ? item.received : (item.recv || 0);
        const oldUsed = item.used !== undefined ? item.used : (item.issued || 0);

        const newReturned = oldReturned + returnedQty;
        const newAvailable = oldReceived - oldUsed - newReturned;
        const clampedAvailable = Math.max(0, newAvailable);

        return {
          ...item,
          returned: newReturned,
          ret: newReturned,
          available: clampedAvailable,
          inStore: clampedAvailable
        };
      }
      return item;
    });
  }, defaultStock);
};

export const processUsage = (materialName, usedQty) => {
  localStore.update('stock', (stock) => {
    return stock.map(item => {
      if (item.mat === materialName || item.material === materialName || item.name === materialName) {
        const oldReturned = item.returned !== undefined ? item.returned : (item.ret || 0);
        const oldReceived = item.received !== undefined ? item.received : (item.recv || 0);
        const oldUsed = item.used !== undefined ? item.used : (item.issued || 0);

        const newUsed = oldUsed + usedQty;
        const newAvailable = oldReceived - newUsed - oldReturned;
        const clampedAvailable = Math.max(0, newAvailable);

        return {
          ...item,
          used: newUsed,
          issued: newUsed,
          available: clampedAvailable,
          inStore: clampedAvailable
        };
      }
      return item;
    });
  }, defaultStock);
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
  'oxygenprotech@gmail.com',
  'radhe.sangwan1980@gmail.com',
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
