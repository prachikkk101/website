// src/context/SiteContext.jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

/* ── Default GA Locations (seed data, matches Access.jsx) ── */
const DEFAULT_SITES = [];

/* ── Read all sites from localStorage (default + custom) ── */
function loadSites() {
  try {
    const raw = localStorage.getItem('gppms_sites');
    if (!raw) return [];
    return JSON.parse(raw);
  } catch { return []; }
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
