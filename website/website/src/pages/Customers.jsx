// src/pages/Customers.jsx
import HouseTable from '../components/HouseTable';

export default function Customers() {
  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
        <span style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:20, background:'#e8f5e4', color:'#2d6a27' }}>
          📍 Site data — Khanna (CA-09)
        </span>
      </div>
      <HouseTable />
    </div>
  );
}
