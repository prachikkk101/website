// src/pages/PELaying.jsx
import { useState, useMemo } from 'react';
import peLaying from '../data/peLaying';
import { exportPELaying } from '../utils/exportExcel';

const SITES       = ['All Sites','Khanna CA-09','UE-II Hisar','PLA Hisar','Kohara CA-07'];
const DATE_RANGES = ['All Time','Last 30 Days','Last 90 Days','Custom'];
const STATUSES    = ['All','LAYING','HDD','JOINT'];

const STATUS_CLS = { LAYING: 'badge-laying', HDD: 'badge-hdd', JOINT: 'badge-joint' };

const KPI_TILES = [
  { label: 'Total Ø32mm Laid',  value: '1,740 mtr' },
  { label: 'Total Ø63mm Laid',  value: '3,580 mtr' },
  { label: 'Total Ø90mm Laid',  value: '1,210 mtr' },
  { label: 'Total Ø125mm Laid', value: '510 mtr'   },
];

export default function PELaying() {
  const [site,      setSite]      = useState('All Sites');
  const [dateRange, setDateRange] = useState('All Time');
  const [raBill,    setRaBill]    = useState('');
  const [status,    setStatus]    = useState('All');

  const filtered = useMemo(() => peLaying.filter(r => {
    if (status !== 'All' && r.status !== status) return false;
    if (raBill && !r.raBill.toLowerCase().includes(raBill.toLowerCase())) return false;
    return true;
  }), [status, raBill]);

  /* Totals */
  const totals = useMemo(() => filtered.reduce((acc, r) => ({
    d32oc: acc.d32oc + r.d32oc,
    d32b:  acc.d32b  + r.d32b,
    d32t:  acc.d32t  + r.d32oc + r.d32b,
    d63oc: acc.d63oc + r.d63oc,
    d63b:  acc.d63b  + r.d63b,
    d63h:  acc.d63h  + r.d63hdd,
    d63t:  acc.d63t  + r.d63oc + r.d63b + r.d63hdd,
    d90:   acc.d90   + r.d90tot,
    d125:  acc.d125  + r.d125tot,
  }), { d32oc:0,d32b:0,d32t:0,d63oc:0,d63b:0,d63h:0,d63t:0,d90:0,d125:0 }), [filtered]);

  return (
    <div>
      {/* Title */}
      <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1f4e1a', margin: '0 0 14px' }}>PE Laying — Pipeline Progress</h1>

      {/* Filter bar */}
      <div className="card section-block" style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <select className="gp-select" value={site} onChange={e => setSite(e.target.value)}>
          {SITES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="gp-select" value={dateRange} onChange={e => setDateRange(e.target.value)}>
          {DATE_RANGES.map(d => <option key={d}>{d}</option>)}
        </select>
        <input
          className="gp-input"
          placeholder="RA Bill No."
          style={{ width: 140 }}
          value={raBill}
          onChange={e => setRaBill(e.target.value)}
        />
        <select className="gp-select" value={status} onChange={e => setStatus(e.target.value)}>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <button className="btn btn-primary">Search</button>
        <button className="btn btn-outline" onClick={() => exportPELaying(filtered)} style={{ marginLeft: 'auto' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export
        </button>
      </div>

      {/* KPI Summary Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
        {KPI_TILES.map(k => (
          <div key={k.label} className="kpi-tile" style={{ background: '#2d6a27' }}>
            <p className="kpi-label">{k.label}</p>
            <p className="kpi-value" style={{ fontSize: 22 }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="gp-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>Sr.</th>
                <th>Laying Date</th>
                <th>Testing Date</th>
                <th>Charging Date</th>
                <th>RA Bill No.</th>
                <th>Report No.</th>
                <th>Status</th>
                <th>Area/Society</th>
                <th>Coil/Batch No.</th>
                <th style={{ textAlign: 'right' }}>Ø32 OC</th>
                <th style={{ textAlign: 'right' }}>Ø32 Boring</th>
                <th style={{ textAlign: 'right' }}>Ø32 Total</th>
                <th style={{ textAlign: 'right' }}>Ø63 OC</th>
                <th style={{ textAlign: 'right' }}>Ø63 Boring</th>
                <th style={{ textAlign: 'right' }}>Ø63 HDD</th>
                <th style={{ textAlign: 'right' }}>Ø63 Total</th>
                <th style={{ textAlign: 'right' }}>Ø90 Total</th>
                <th style={{ textAlign: 'right' }}>Ø125 Total</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const d32t = r.d32oc + r.d32b;
                const d63t = r.d63oc + r.d63b + r.d63hdd;
                const num  = v => v > 0 ? v : <span style={{ color: '#cbd5e1' }}>—</span>;
                return (
                  <tr key={r.sr}>
                    <td style={{ textAlign: 'center', color: '#94a3b8' }}>{r.sr}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.layDate}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.testDate}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.chargeDate}</td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 11 }}>{r.raBill}</td>
                    <td style={{ textAlign: 'center' }}>{r.reportNo}</td>
                    <td><span className={`badge ${STATUS_CLS[r.status]}`}>{r.status}</span></td>
                    <td style={{ whiteSpace: 'nowrap' }}>{r.area}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.coil}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{num(r.d32oc)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{num(r.d32b)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{num(d32t)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{num(r.d63oc)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{num(r.d63b)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{num(r.d63hdd)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{num(d63t)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{num(r.d90tot)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{num(r.d125tot)}</td>
                  </tr>
                );
              })}

              {/* Totals row */}
              <tr style={{ background: '#f0f7ee' }}>
                <td colSpan={9} style={{ fontWeight: 700, color: '#1f4e1a', textAlign: 'right', fontSize: 12 }}>TOTAL</td>
                <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{totals.d32oc}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{totals.d32b}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{totals.d32t}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{totals.d63oc}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{totals.d63b}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{totals.d63h}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{totals.d63t}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{totals.d90}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{totals.d125}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
