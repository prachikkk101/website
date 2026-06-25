// src/pages/Customers.jsx
import HouseTable from '../components/HouseTable';
import { useSite } from '../context/SiteContext';

export default function Customers() {
  const { selectedSite, siteOptions } = useSite();
  const selectedLabel = siteOptions.find(s => s.value === selectedSite)?.label || 'All Sites';

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
        <span style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:20, background:'#e8f5e4', color:'#2d6a27' }}>
          📍 Site data — {selectedLabel}
        </span>
      </div>
      <HouseTable />
    </div>
  );
}
