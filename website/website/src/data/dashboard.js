// src/data/dashboard.js
// Static dashboard KPI and site data

export const kpiData = {
  domestic: {
    applicationNo: 2673,
    bpNumber: 1399,
    feasibilityDone: 522,
    meterInstalled: 368,
    giInstalled: 454,
    lmcDone: 368,
    jmrGasIn: 374,
  },
  commercial: {
    applicationNo: 421,
    bpNumber: 218,
    feasibilityDone: 98,
    meterInstalled: 72,
    giInstalled: 85,
    lmcDone: 72,
    jmrGasIn: 68,
  },
  industrial: {
    applicationNo: 89,
    bpNumber: 45,
    feasibilityDone: 32,
    meterInstalled: 28,
    giInstalled: 30,
    lmcDone: 28,
    jmrGasIn: 26,
  },
  cng: {
    applicationNo: 12,
    bpNumber: 8,
    feasibilityDone: 6,
    meterInstalled: 5,
    giInstalled: 5,
    lmcDone: 5,
    jmrGasIn: 4,
  },
};

export const sitesData = [
  { name: 'Khanna — CA-09', subtitle: 'Zone-02, Ludhiana', done: 841, total: 1350, status: 'Active', alert: null },
  { name: 'UE-II — Hisar', subtitle: 'Urban Extension II', done: 420, total: 1100, status: 'Active', alert: null },
  { name: 'PLA — Hisar', subtitle: 'P.L.A Colony', done: 280, total: 900, status: 'Active', alert: null },
  { name: 'Kohara — CA-07', subtitle: 'Kohara, Ludhiana', done: 190, total: 980, status: 'Low Stock', alert: 'low' },
];

export const housesDoneThisMonth = [
  { site: 'Khanna', pct: 62 },
  { site: 'UE-II', pct: 38 },
  { site: 'PLA', pct: 31 },
  { site: 'Kohara', pct: 19 },
];

export const dailyEntries = [
  { day: 'Mon', count: 48, site: 'Khanna' },
  { day: 'Tue', count: 62, site: 'Khanna' },
  { day: 'Wed', count: 55, site: 'Khanna' },
  { day: 'Thu', count: 70, site: 'Khanna' },
  { day: 'Fri', count: 41, site: 'Khanna' },
  { day: 'Sat', count: 28, site: 'Khanna' },
  { day: 'Sun', count: 18, site: 'Khanna' },
];

export const activeWorkers = [
  { id: 1, initials: 'AK', name: 'Atul Kumar', role: 'Supervisor', site: 'Khanna', lastSeen: 'Today', color: '#2d6a27' },
  { id: 2, initials: 'RS', name: 'Ravi Sharma', role: 'Plumber', site: 'Khanna', lastSeen: 'Today', color: '#2d6a27' },
  { id: 3, initials: 'GP', name: 'Gurpreet Singh', role: 'Welder', site: 'Khanna', lastSeen: 'Yesterday', color: '#c0440a' },
  { id: 4, initials: 'MY', name: 'Mohit Yadav', role: 'Labour', site: 'UE-II', lastSeen: 'Today', color: '#2d6a27' },
  { id: 5, initials: 'SS', name: 'Sukhvir Singh', role: 'Plumber', site: 'PLA', lastSeen: '2 days ago', color: '#6b7280' },
  { id: 6, initials: 'RK', name: 'Ramesh Kumar', role: 'Plumber', site: 'UE-II', lastSeen: 'Today', color: '#2d6a27' },
];

export const lowStockAlerts = [
  { site: 'Khanna', material: '32mm PE Pipe', qty: '12 mtr left' },
  { site: 'Khanna', material: '125mm Elbow', qty: '3 pcs left' },
];
