// src/data/dashboard.js
// Dashboard data is derived live from localStorage — no static dummy values

export const kpiData = {
  domestic:   { applicationNo: 0, bpNumber: 0, feasibilityDone: 0, meterInstalled: 0, giInstalled: 0, lmcDone: 0, jmrGasIn: 0 },
  commercial: { applicationNo: 0, bpNumber: 0, feasibilityDone: 0, meterInstalled: 0, giInstalled: 0, lmcDone: 0, jmrGasIn: 0 },
  industrial: { applicationNo: 0, bpNumber: 0, feasibilityDone: 0, meterInstalled: 0, giInstalled: 0, lmcDone: 0, jmrGasIn: 0 },
  cng:        { applicationNo: 0, bpNumber: 0, feasibilityDone: 0, meterInstalled: 0, giInstalled: 0, lmcDone: 0, jmrGasIn: 0 },
};

export const sitesData = [];
export const housesDoneThisMonth = [];
export const dailyEntries = [];
export const activeWorkers = [];
export const lowStockAlerts = [];
