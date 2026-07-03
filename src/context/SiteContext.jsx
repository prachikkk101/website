import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { AuthContext } from './AuthContext';
import api from '../utils/api';

/* ── Context default ── */
export const SiteContext = createContext({
  selGA: 'all',
  selCity: 'all',
  selArea: 'all',
  setSelGA: () => { },
  setSelCity: () => { },
  setSelArea: () => { },
  globalLocationContext: { gaId: 'all', cityId: 'all', area: 'all' },
  setGlobalLocationContext: () => { },
  selectedSite: 'all',
  setSelectedSite: () => { },
  siteOptions: [],
  siteList: [],
  mergedGAs: [],
  getCitiesForGA: () => [],
  getAreasForCity: () => [],
  selectedSiteId: null,
  setSelectedSiteId: () => { },
});

export function SiteProvider({ children }) {
  const { user } = useContext(AuthContext);

  // 3-level cascading state
  const [selGA, setSelGARaw] = useState('all');
  const [selCity, setSelCityRaw] = useState('all');
  const [selArea, setSelAreaRaw] = useState('all');

  // Global location context (navbar flyout selection — feeds entry forms)
  const [globalLocationContext, setGlobalLocationContext] = useState({ gaId: 'all', cityId: 'all', area: 'all' });

  // Legacy single-dropdown (still used by older components)
  const [selectedSite, setSelectedSite] = useState('all');

  const [siteList, setSiteList] = useState([]);
  const [backendGALocations, setBackendGALocations] = useState([]);
  const [backendCities, setBackendCities] = useState([]);
  const [backendAreas, setBackendAreas] = useState([]);

  // Store the active selected site ID (UUID)
  const [selectedSiteId, setSelectedSiteId] = useState(() => {
    try {
      const sess = JSON.parse(localStorage.getItem('gppms_session') || '{}');
      return sess.siteId || null;
    } catch { return null; }
  });

  // Sync selectedSiteId immediately if user session changes
  useEffect(() => {
    if (user?.siteId) {
      setSelectedSiteId(user.siteId);
    }
  }, [user]);

  // Fetch sites from backend and populate siteList + location lists
  useEffect(() => {
    const token = localStorage.getItem('gppms_token');
    if (!token) return;

    api.get('/sites')
      .then(res => {
        if (res.data?.success && res.data?.sites) {
          const backendSites = res.data.sites;
          setSiteList(backendSites);

          // If selectedSiteId is not set, or is not in the list of fetched sites, set to first site
          if (backendSites.length > 0) {
            setSelectedSiteId(currentId => {
              if (currentId && backendSites.some(s => s.id === currentId)) {
                return currentId;
              }
              return backendSites[0].id;
            });
          }
        }
      })
      .catch(err => {
        console.error('Failed to fetch sites from backend in SiteContext:', err);
      });

    Promise.all([
      api.get('/ga-locations'),
      api.get('/cities'),
      api.get('/areas')
    ])
      .then(([gaRes, cityRes, areaRes]) => {
        if (gaRes.data?.success && gaRes.data?.gaLocations) {
          setBackendGALocations(gaRes.data.gaLocations);
        }
        if (cityRes.data?.success && cityRes.data?.cities) {
          setBackendCities(cityRes.data.cities);
        }
        if (areaRes.data?.success && areaRes.data?.areas) {
          setBackendAreas(areaRes.data.areas);
        }
      })
      .catch(err => {
        console.error('Failed to fetch location hierarchy in SiteContext:', err);
      });
  }, [user]);

  // Dynamic merged list reconstructed from backend lists
  const mergedGAs = useMemo(() => {
    return backendGALocations.map(ga => {
      const gaCities = backendCities.filter(c => c.gaId === ga.id);
      return {
        ...ga,
        cities: gaCities.map(city => {
          const cityAreas = backendAreas.filter(a => a.cityId === city.id && a.gaId === ga.id).map(a => a.name || a.label);
          return {
            ...city,
            areas: cityAreas
          };
        })
      };
    });
  }, [backendGALocations, backendCities, backendAreas]);

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
    if (val && val !== 'all') {
      setSelectedSiteId(val);
    }
  }

  function setSelCity(val) {
    setSelCityRaw(val);
    setSelAreaRaw('all');
  }

  // Set selected area
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
      globalLocationContext, setGlobalLocationContext,
      selectedSite, setSelectedSite,
      siteOptions, siteList, mergedGAs,
      getCitiesForGA, getAreasForCity,
      selectedSiteId, setSelectedSiteId
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
