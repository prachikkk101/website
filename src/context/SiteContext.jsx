// src/context/SiteContext.jsx
import { createContext, useContext, useState } from 'react';
import { houses as initialHouses } from '../data/houses';
import initialStockData from '../data/stockData';
import initialPeLaying from '../data/peLaying';

export const SITE_OPTIONS = [
  { value: 'all',    label: 'All Sites' },
  { value: 'khanna', label: 'Khanna — CA-09' },
  { value: 'uenii',  label: 'UE-II — Hisar' },
  { value: 'pla',    label: 'PLA — Hisar' },
  { value: 'kohara', label: 'Kohara — CA-07' },
];

const SiteContext = createContext({
  selectedSite: 'all',
  setSelectedSite: () => {},
  houses: [],
  setHouses: () => {},
  stock: [],
  setStock: () => {},
  peLayingList: [],
  setPeLayingList: () => {},
  toasts: [],
  showToast: () => {},
});

export function SiteProvider({ children }) {
  const [selectedSite, setSelectedSite] = useState('all');
  const [houses, setHouses] = useState(initialHouses);
  const [stock, setStock] = useState(initialStockData);
  const [peLayingList, setPeLayingList] = useState(initialPeLaying);
  const [toasts, setToasts] = useState([]);

  const showToast = (message) => {
    const id = Date.now() + Math.random().toString();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  return (
    <SiteContext.Provider value={{
      selectedSite,
      setSelectedSite,
      houses,
      setHouses,
      stock,
      setStock,
      peLayingList,
      setPeLayingList,
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

