// src/pages/ICWork.jsx
import { useState, useMemo } from 'react';
import icData from '../data/icWork';

const SITES   = ['All Sites','Khanna','UE-II','Ludhiana'];
const AREAS   = ['All','Khanna','UE-II','Ludhiana'];
const STATUSES = ['All','Done','Pending'];

const donePct  = Math.round((icData.filter(r => r.status === 'Done').length / icData.length) * 100);
const pendPct  = 100 - donePct;

export default function ICWork() {
  const [site,   setSite]   = useState('All Sites');
  const [area,   setArea]   = useState('All');
  const [status, setStatus] = useState('All');

  const filtered = useMemo(() => icData.filter(r => {
    if (area !== 'All' && r.area !== area) return false;
    if (status !== 'All' && r.status !== status) return false;
    return true;
  }), [area, status]);

  const doneCount    = filtered.filter(r => r.status === 'Done').length;
  const pendingCount = filtered.filter(r => r.status === 'Pending').length;

  return (
    <div>
      {/* Title */}
      <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1f4e1a', margin: '0 0 14px' }}>
        I&C Work — Installation & Commissioning
      </h1>

      {/* KPI tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16, maxWidth: 400 }}>
        <div className="kpi-tile" style={{ background: '#2d6a27' }}>
          <p className="kpi-label">I&C Done</p>
          <p className="kpi-value">{doneCount}</p>
        </div>
        <div className="kpi-tile" style={{ background: '#c0440a' }}>
          <p className="kpi-label">Pending</p>
          <p className="kpi-value">{pendingCount}</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="card section-block" style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <select className="gp-select" value={site} onChange={e => setSite(e.target.value)}>
          {SITES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="gp-select" value={area} onChange={e => setArea(e.target.value)}>
          {AREAS.map(a => <option key={a}>{a}</option>)}
        </select>
        <select className="gp-select" value={status} onChange={e => setStatus(e.target.value)}>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <button className="btn btn-primary">Search</button>
        <button className="btn btn-outline" style={{ marginLeft: 'auto' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export
        </button>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="gp-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>Sr.</th>
                <th style={{ minWidth: 200 }}>Customer / Site Name</th>
                <th style={{ minWidth: 160 }}>Address</th>
                <th>Area</th>
                <th>I&C Date</th>
                <th>Service Reg. No.</th>
                <th>Meter Serial No.</th>
                <th>Pressure (mbar)</th>
                <th>Flow Rate</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.sr}>
                  <td style={{ textAlign: 'center', color: '#94a3b8' }}>{r.sr}</td>
                  <td style={{ fontWeight: 600 }}>{r.name}</td>
                  <td style={{ fontSize: 11.5, color: '#64748b' }}>{r.addr}</td>
                  <td>{r.area}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.date}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.regNo}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.meterNo}</td>
                  <td style={{ textAlign: 'right' }}>{r.pressure}</td>
                  <td style={{ textAlign: 'right' }}>{r.flow}</td>
                  <td>
                    <span className={`badge ${r.status === 'Done' ? 'badge-done' : 'badge-updated'}`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
                    No records match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
