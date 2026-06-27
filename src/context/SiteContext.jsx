// src/context/SiteContext.jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { siteService } from '../api/siteService';
import { useAuth } from './AuthContext';

// ── Static fallback sites for local / offline mode ──
const LOCAL_SITES = [
  { id: 'local-site-1', name: 'Khanna — CA-09',  location: 'Zone-02, Ludhiana' },
  { id: 'local-site-2', name: 'UE-II — Hisar',   location: 'Urban Extension II' },
  { id: 'local-site-3', name: 'PLA — Hisar',     location: 'PLA Colony' },
  { id: 'local-site-4', name: 'Kohara — CA-07',  location: 'Kohara, Ludhiana' },
];

const SiteContext = createContext({
  selectedSite: 'all',
  setSelectedSite: () => {},
  sites: [],
  sitesLoading: false,
  refreshSites: () => {},
  toasts: [],
  showToast: () => {},
});

export function SiteProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [selectedSite, setSelectedSite] = useState('all');
  const [sites, setSites] = useState([]);
  const [sitesLoading, setSitesLoading] = useState(false);
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message) => {
    const id = Date.now() + Math.random().toString();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const refreshSites = useCallback(async () => {
    if (!isAuthenticated) return;
    setSitesLoading(true);
    try {
      const data = await siteService.getSites();
      if (data.success !== false) {
        const siteList = Array.isArray(data) ? data : (data.sites || []);
        // If backend returned real sites, use them; otherwise fall back to local
        setSites(siteList.length > 0 ? siteList : LOCAL_SITES);
      }
    } catch {
      // Backend offline — use local static sites so components can render
      setSites(LOCAL_SITES);
    } finally {
      setSitesLoading(false);
    }
  }, [isAuthenticated]);

  // Fetch sites when user is authenticated
  useEffect(() => {
    if (isAuthenticated) {
      refreshSites();
    } else {
      setSites([]);
      setSelectedSite('all');
    }
  }, [isAuthenticated, refreshSites]);

  // Build site options for dropdowns
  const siteOptions = [
    { value: 'all', label: 'All Sites' },
    ...sites.map((s) => ({ value: s.id, label: s.name })),
  ];

  return (
    <SiteContext.Provider value={{
      selectedSite,
      setSelectedSite,
      sites,
      siteOptions,
      sitesLoading,
      refreshSites,
      toasts,
      showToast,
    }}>
      {children}
    </SiteContext.Provider>
  );
}

export function useSite() {
  return useContext(SiteContext);
}

// Helper: get current site ID (returns null if "all")
export function useSelectedSiteId() {
  const { selectedSite } = useSite();
  return selectedSite === 'all' ? null : selectedSite;
}
