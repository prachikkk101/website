// src/context/SiteContext.jsx
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { gaLocations } from '../data/gaLocations';

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
  mergedGAs:       [],
  getCitiesForGA:  () => [],
  getAreasForCity: () => [],
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

  // Dynamic merged list
  const mergedGAs = useMemo(() => {
    const list = [...gaLocations];
    siteList.forEach(s => {
      if (!list.some(x => x.id === s.id)) {
        list.push(s);
      }
    });
    return list;
  }, [siteList]);

  // Dynamic helper functions
  const getCitiesForGA = useCallback((gaId) => {
    if (gaId === 'all') return [];
    const ga = mergedGAs.find(g => g.id === gaId);
    return ga ? (ga.cities || []) : [];
  }, [mergedGAs]);

  const getAreasForCity = useCallback((cityId) => {
    if (cityId === 'all') return [];
    for (const ga of mergedGAs) {
      const city = (ga.cities || []).find(c => c.id === cityId);
      if (city) return city.areas || [];
    }
    return [];
  }, [mergedGAs]);

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
      siteOptions, siteList, mergedGAs,
      getCitiesForGA, getAreasForCity
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
  const { selGA, selCity, mergedGAs } = useContext(SiteContext);

  // Helper inside hook using merged list
  const helperGetAreasForCity = (cityId) => {
    for (const ga of mergedGAs) {
      const city = (ga.cities || []).find(c => c.id === cityId);
      if (city) return city.areas || [];
    }
    return [];
  };

  // If a city is selected, return its areas
  if (selCity && selCity !== 'all') return helperGetAreasForCity(selCity);

  // If a GA is selected, merge areas of all its cities
  if (selGA && selGA !== 'all') {
    const ga = mergedGAs.find(g => g.id === selGA);
    if (ga) {
      const all = [];
      (ga.cities || []).forEach(c => (c.areas || []).forEach(a => { if (!all.includes(a)) all.push(a); }));
      return all;
    }
  }

  // All areas across all sites
  const all = [];
  mergedGAs.forEach(ga =>
    (ga.cities || []).forEach(c => (c.areas || []).forEach(a => { if (!all.includes(a)) all.push(a); }))
  );
  return [...new Set(all)];
}

/* ── Legacy static export ── */
export const SITE_OPTIONS = [{ value: 'all', label: 'GA Locations' }];
