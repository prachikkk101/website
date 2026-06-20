// src/pages/Customers.jsx
import HouseTable from '../components/HouseTable';

export default function Customers() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div
          className="flex items-center gap-2 text-sm font-semibold px-3 py-1.5 rounded-lg"
          style={{ background: '#e8f5e4', color: '#2d6a27' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
            <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
          </svg>
          Site data — Khanna (CA-09)
        </div>
      </div>
      <HouseTable />
    </div>
  );
}
