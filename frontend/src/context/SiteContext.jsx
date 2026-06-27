// src/context/SiteContext.jsx
import { createContext, useContext, useState } from 'react';

export const SITE_OPTIONS = [
  { value: 'all',    label: 'GA Dashboard' },
  { value: 'khanna', label: 'Khanna — CA-09' },
  { value: 'uenii',  label: 'UE-II — Hisar' },
  { value: 'pla',    label: 'PLA — Hisar' },
  { value: 'kohara', label: 'Kohara — CA-07' },
];

const SiteContext = createContext({
  selectedSite: 'all',
  setSelectedSite: () => {},
});

export function SiteProvider({ children }) {
  const [selectedSite, setSelectedSite] = useState('all');
  return (
    <SiteContext.Provider value={{ selectedSite, setSelectedSite }}>
      {children}
    </SiteContext.Provider>
  );
}

export function useSite() {
  return useContext(SiteContext);
}
