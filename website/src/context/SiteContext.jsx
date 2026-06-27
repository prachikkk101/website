// src/context/SiteContext.jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { siteService } from '../api/siteService';
import { useAuth } from './AuthContext';

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
        // API may return { success: true, sites: [...] } or directly an array
        const siteList = Array.isArray(data) ? data : (data.sites || []);
        setSites(siteList);
      }
    } catch (err) {
      console.error('Failed to fetch sites:', err);
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
