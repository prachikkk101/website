// src/context/SiteContext.jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

/* ── Default GA Locations (seed data, matches Access.jsx) ── */
const DEFAULT_SITES = [
  { id: 'khanna', name: 'Khanna — CA-09', zone: 'Zone-02, Ludhiana',   areas: ['Uttam Nagar','Guru Nanak Nagar','Kishangar Village','Sector 12'], status: 'Active' },
  { id: 'uenii',  name: 'UE-II — Hisar',  zone: 'Urban Extension II', areas: ['UE-II'],                                                             status: 'Active' },
  { id: 'pla',    name: 'PLA — Hisar',    zone: 'P.L.A Colony',        areas: ['PLA'],                                                              status: 'Active' },
  { id: 'kohara', name: 'Kohara — CA-07', zone: 'Kohara, Ludhiana',    areas: ['Kohara'],                                                           status: 'Active' },
];

/* ── Read all sites from localStorage (default + custom) ── */
function loadSites() {
  try {
    const raw = localStorage.getItem('gppms_sites');
    if (!raw) return DEFAULT_SITES;
    const parsed = JSON.parse(raw);
    const storedIds = parsed.map(s => s.id);
    // Merge: defaults first (not overridden by stored), then custom additions
    return [...DEFAULT_SITES.filter(d => !storedIds.includes(d.id)), ...parsed];
  } catch { return DEFAULT_SITES; }
}

/* ── Build dropdown options from live sites ── */
function buildOptions(siteList) {
  return [
    { value: 'all', label: 'GA Locations' },   // <-- renamed from "GA Dashboard"
    ...siteList.map(s => ({ value: s.id, label: s.name })),
  ];
}

/* ── Context ── */
const SiteContext = createContext({
  selectedSite:    'all',
  setSelectedSite: () => {},
  siteOptions:     [{ value: 'all', label: 'GA Locations' }],
  siteList:        DEFAULT_SITES,
});

export function SiteProvider({ children }) {
  const [selectedSite,    setSelectedSite]    = useState('all');
  const [siteList,        setSiteList]        = useState(() => loadSites());

  // Re-sync whenever another tab or the Access page writes to localStorage
  const syncSites = useCallback(() => setSiteList(loadSites()), []);

  useEffect(() => {
    window.addEventListener('storage', syncSites);
    // Also re-read on mount in case Access already wrote new data
    syncSites();
    return () => window.removeEventListener('storage', syncSites);
  }, [syncSites]);

  const siteOptions = buildOptions(siteList);

  return (
    <SiteContext.Provider value={{ selectedSite, setSelectedSite, siteOptions, siteList }}>
      {children}
    </SiteContext.Provider>
  );
}

export function useSite() {
  return useContext(SiteContext);
}

/* ── useSiteAreas: returns areas for the selected site (or all merged areas) ── */
export function useSiteAreas() {
  const { selectedSite, siteList } = useContext(SiteContext);
  if (!selectedSite || selectedSite === 'all') {
    // Merge all areas across all sites, deduplicated
    const all = [];
    siteList.forEach(s => (s.areas || []).forEach(a => { if (!all.includes(a)) all.push(a); }));
    return all;
  }
  const site = siteList.find(s => s.id === selectedSite);
  return site?.areas || [];
}

/* ── Legacy static export (kept for backwards compatibility with imports) ── */
// Components that do: import { SITE_OPTIONS } from '../context/SiteContext'
// now get the default seed — they should switch to useSite().siteOptions for live data
export const SITE_OPTIONS = buildOptions(DEFAULT_SITES);
