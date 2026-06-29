// src/context/SiteContext.jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { gaLocations, getCitiesForGA, getAreasForCity } from '../data/gaLocations';

/* ── Read custom sites from localStorage ── */
function loadSites() {
  try {
    const raw = localStorage.getItem('gppms_sites');
    if (!raw) return [];
    return JSON.parse(raw);
  } catch { return []; }
}

/* ── Context default ── */
const SiteContext = createContext({
  // 3-level selection
  selGA:    'all',
  selCity:  'all',
  selArea:  'all',
  setSelGA:   () => {},
  setSelCity: () => {},
  setSelArea: () => {},

  // Legacy — kept for backward compat
  selectedSite:    'all',
  setSelectedSite: () => {},
  siteOptions:     [],
  siteList:        [],
});

export function SiteProvider({ children }) {
  // 3-level cascading state
  const [selGA,   setSelGARaw]   = useState('all');
  const [selCity, setSelCityRaw] = useState('all');
  const [selArea, setSelAreaRaw] = useState('all');

  // Legacy single-dropdown (still used by older components)
  const [selectedSite, setSelectedSite] = useState('all');

  // Custom sites from localStorage (Access page)
  const [siteList, setSiteList] = useState(() => loadSites());

  const syncSites = useCallback(() => setSiteList(loadSites()), []);
  useEffect(() => {
    window.addEventListener('storage', syncSites);
    syncSites();
    return () => window.removeEventListener('storage', syncSites);
  }, [syncSites]);

  // Cascading setters — reset children when parent changes
  function setSelGA(val) {
    setSelGARaw(val);
    setSelCityRaw('all');
    setSelAreaRaw('all');
    setSelectedSite(val); // keep legacy in sync
  }

  function setSelCity(val) {
    setSelCityRaw(val);
    setSelAreaRaw('all');
  }

  function setSelArea(val) {
    setSelAreaRaw(val);
  }

  // Legacy options built from custom sites list
  const siteOptions = [
    { value: 'all', label: 'GA Locations' },
    ...siteList.map(s => ({ value: s.id, label: s.name || s.label })),
  ];

  return (
    <SiteContext.Provider value={{
      selGA, selCity, selArea,
      setSelGA, setSelCity, setSelArea,
      selectedSite, setSelectedSite,
      siteOptions, siteList,
    }}>
      {children}
    </SiteContext.Provider>
  );
}

export function useSite() {
  return useContext(SiteContext);
}

/* ── useSiteAreas: areas visible in current 3-level selection ── */
export function useSiteAreas() {
  const { selGA, selCity, siteList } = useContext(SiteContext);

  // If a city is selected, return its areas from the static hierarchy
  if (selCity && selCity !== 'all') return getAreasForCity(selCity);

  // If a GA is selected, merge areas of all its cities
  if (selGA && selGA !== 'all') {
    const ga = gaLocations.find(g => g.id === selGA);
    if (ga) {
      const all = [];
      ga.cities.forEach(c => c.areas.forEach(a => { if (!all.includes(a)) all.push(a); }));
      return all;
    }
    // Fall through to custom sites
    const site = siteList.find(s => s.id === selGA);
    if (site) {
      // Custom 3-level sites
      if (site.cities) {
        const all = [];
        site.cities.forEach(c => (c.areas || []).forEach(a => { if (!all.includes(a)) all.push(a); }));
        return all;
      }
      return site.areas || [];
    }
  }

  // All areas across all static + custom sites
  const all = [];
  gaLocations.forEach(ga =>
    ga.cities.forEach(c => c.areas.forEach(a => { if (!all.includes(a)) all.push(a); }))
  );
  siteList.forEach(s => {
    if (s.cities) {
      s.cities.forEach(c => (c.areas || []).forEach(a => { if (!all.includes(a)) all.push(a); }));
    } else {
      (s.areas || []).forEach(a => { if (!all.includes(a)) all.push(a); });
    }
  });
  return [...new Set(all)];
}

/* ── Legacy static export ── */
export const SITE_OPTIONS = [{ value: 'all', label: 'GA Locations' }];
