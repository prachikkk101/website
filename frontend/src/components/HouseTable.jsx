// src/components/HouseTable.jsx
import { useState, useMemo } from 'react';
import { houses, areas, acctTypes } from '../data/houses';
import MeterModal from './MeterModal';
import { exportHouseData } from '../utils/exportExcel';

/* ── Status Badge ── */
const STATUS_MAP = {
  'Done':        'badge-done',
  'Done 3.0':    'badge-done',
  'Pending':     'badge-pending',
  'Not Updated': 'badge-updated',
  'RFC':         'badge-rfc',
  '-':           '',
  '—':           '',
};

function StatusBadge({ val }) {
  if (!val || val === '-' || val === '—') return <span style={{ color: '#cbd5e1' }}>—</span>;
  const cls = STATUS_MAP[val] ?? 'badge-done';
  return <span className={`badge ${cls}`}>{val}</span>;
}

const PAGE_SIZE = 8;

/* ── Column widths for filter inputs ── */
const INPUT_WIDTHS = { acct: 160, agency: 220, area: 160, bp: 130, house: 160, meter: 120 };

export default function HouseTable() {
  const [view,          setView]          = useState('houses');
  const [filterAcct,    setFilterAcct]    = useState('');
  const [filterArea,    setFilterArea]    = useState('');
  const [filterBP,      setFilterBP]      = useState('');
  const [filterHouse,   setFilterHouse]   = useState('');
  const [filterMeter,   setFilterMeter]   = useState('');
  const [page,          setPage]          = useState(1);
  const [modalHouse,    setModalHouse]    = useState(null);

  function reset() { setPage(1); }

  const filtered = useMemo(() => houses.filter(h => {
    if (filterAcct  && h.acctType !== filterAcct) return false;
    if (filterArea  && h.area     !== filterArea)  return false;
    if (filterBP    && !h.bpNo.includes(filterBP))         return false;
    if (filterHouse && !h.houseNo.toLowerCase().includes(filterHouse.toLowerCase())) return false;
    if (filterMeter && !h.meterNo.includes(filterMeter))   return false;
    return true;
  }), [filterAcct, filterArea, filterBP, filterHouse, filterMeter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged      = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      {/* ── Toggle + Export ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ display: 'flex' }}>
          <button
            onClick={() => { setView('houses'); reset(); }}
            className={`btn ${view === 'houses' ? 'btn-primary' : 'btn-outline'}`}
            style={{ borderRadius: '5px 0 0 5px' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            </svg>
            House Connections
          </button>
          <button
            onClick={() => { setView('stock'); reset(); }}
            className={`btn ${view === 'stock' ? 'btn-primary' : 'btn-outline'}`}
            style={{ borderRadius: '0 5px 5px 0', borderLeft: 'none' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
            Stock Status
          </button>
        </div>

        <button
          onClick={() => exportHouseData(filtered)}
          className="btn btn-outline"
          style={{ marginLeft: 'auto' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export Excel
        </button>
      </div>

      {view === 'houses' ? (
        <>
          {/* ── Filter Bar ── */}
          <div className="card section-block" style={{ padding: '10px 14px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              <select
                className="gp-select-dark"
                style={{ width: INPUT_WIDTHS.acct }}
                value={filterAcct}
                onChange={e => { setFilterAcct(e.target.value); reset(); }}
              >
                <option value="">-- Account Type --</option>
                {acctTypes.map(a => <option key={a}>{a}</option>)}
              </select>

              <select
                className="gp-select-dark"
                style={{ width: INPUT_WIDTHS.agency }}
              >
                <option>OXYGEN PROTECH PVT LTD</option>
              </select>

              <select
                className="gp-select-dark"
                style={{ width: INPUT_WIDTHS.area }}
                value={filterArea}
                onChange={e => { setFilterArea(e.target.value); reset(); }}
              >
                <option value="">Select Area</option>
                {areas.map(a => <option key={a}>{a}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <input
                className="gp-input-dark"
                style={{ width: INPUT_WIDTHS.bp }}
                placeholder="BP Number"
                value={filterBP}
                onChange={e => { setFilterBP(e.target.value); reset(); }}
              />
              <input
                className="gp-input-dark"
                style={{ width: INPUT_WIDTHS.house }}
                placeholder="House No / Address"
                value={filterHouse}
                onChange={e => { setFilterHouse(e.target.value); reset(); }}
              />
              <input
                className="gp-input-dark"
                style={{ width: INPUT_WIDTHS.meter }}
                placeholder="Meter No."
                value={filterMeter}
                onChange={e => { setFilterMeter(e.target.value); reset(); }}
              />
              <button
                className="btn btn-primary"
                onClick={reset}
              >Search</button>
            </div>
          </div>

          {/* Showing info */}
          <p style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>
            Showing page {page} of {Math.max(1, totalPages)} — {filtered.length} entries
          </p>

          {/* ── Table ── */}
          <div className="card section-block" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="gp-table">
                <thead>
                  <tr>
                    {['Acct','BP No.','Name','Mobile','House No.','Area','City','Meter No.','Meter Date','GC Status','GI Status','RFC','NG Status','SARAL','Photo','Action'].map(col => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paged.map(h => (
                    <tr key={h.id}>
                      <td style={{ fontSize: 11, color: '#64748b' }}>{h.acctType}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{h.bpNo}</td>
                      <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{h.name}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{h.mobile}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{h.houseNo}</td>
                      <td>{h.area}</td>
                      <td>{h.city}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{h.meterNo}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{h.meterDate}</td>
                      <td><StatusBadge val={h.gcStatus}    /></td>
                      <td><StatusBadge val={h.giStatus}    /></td>
                      <td><StatusBadge val={h.rfc}         /></td>
                      <td><StatusBadge val={h.ngStatus}    /></td>
                      <td><StatusBadge val={h.saralStatus} /></td>
                      <td style={{ textAlign: 'center' }}>
                        {h.meterPhoto
                          ? <span style={{ color: '#16a34a', fontWeight: 700 }}>✓</span>
                          : <span style={{ color: '#dc2626', fontWeight: 700 }}>✗</span>
                        }
                      </td>
                      <td>
                        <button
                          onClick={e => { e.stopPropagation(); setModalHouse(h); }}
                          className="btn btn-primary btn-sm"
                          style={{ borderRadius: 4 }}
                        >
                          Meter Details
                        </button>
                      </td>
                    </tr>
                  ))}
                  {paged.length === 0 && (
                    <tr>
                      <td colSpan={16} style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8' }}>
                        No records match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* ── Pagination ── */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '12px 16px', borderTop: '1px solid #e5e7eb' }}>
                <button className="page-btn" onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}>←</button>
                {Array.from({ length: totalPages }, (_, i) => i+1).map(p => (
                  <button key={p} className={`page-btn${p===page?' active':''}`} onClick={() => setPage(p)}>{p}</button>
                ))}
                <button className="page-btn" onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages}>→</button>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
          Stock Status is shown in the <strong style={{ color: '#374151' }}>Inventory</strong> section. Use the top nav to navigate there.
        </div>
      )}

      {/* Meter Modal */}
      {modalHouse && (
        <MeterModal
          house={modalHouse}
          onClose={() => setModalHouse(null)}
          onSave={() => setModalHouse(null)}
        />
      )}
    </div>
  );
}
