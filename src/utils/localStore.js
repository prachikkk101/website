// src/utils/localStore.js
// Thin localStorage wrapper with JSON parse/stringify and error handling.
export const localStore = {
  get: (key, fallback) => {
    try {
      const val = localStorage.getItem('gppms_' + key);
      return val ? JSON.parse(val) : fallback;
    } catch { return fallback; }
  },
  set: (key, value) => {
    localStorage.setItem('gppms_' + key, JSON.stringify(value));
  },
  update: (key, updaterFn, fallback) => {
    const current = localStore.get(key, fallback);
    const updated = updaterFn(current);
    localStore.set(key, updated);
    return updated;
  },
};
