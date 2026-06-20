// src/components/HouseTable.jsx
import { useState, useMemo } from 'react';
import { houses, areas, societies, acctTypes } from '../data/houses';
import MeterModal from './MeterModal';
import { exportHouseData } from '../utils/exportExcel';

const STATUS_BADGE = {
  'Done': 'badge-done',
  'Done 3.0': 'badge-done',
  'Pending': 'badge-pending',
  'Not Updated': 'badge-updated',
  'RFC': 'badge-rfc',
  '-': '',
};

function StatusBadge({ val }) {
  if (!val || val === '-') return <span className="text-gray-400">—</span>;
  const cls = STATUS_BADGE[val] || 'badge-done';
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${cls}`}>
      {val}
    </span>
  );
}

const PAGE_SIZE = 8;

export default function HouseTable() {
  const [view, setView] = useState('houses'); // 'houses' | 'stock'
  const [filterAcct, setFilterAcct] = useState('');
  const [filterArea, setFilterArea] = useState('');
  const [filterSociety, setFilterSociety] = useState('');
  const [filterBP, setFilterBP] = useState('');
  const [filterHouse, setFilterHouse] = useState('');
  const [filterMeter, setFilterMeter] = useState('');
  const [page, setPage] = useState(1);
  const [modalHouse, setModalHouse] = useState(null);

  const filtered = useMemo(() => {
    return houses.filter(h => {
      if (filterAcct && h.acctType !== filterAcct) return false;
      if (filterArea && h.area !== filterArea) return false;
      if (filterBP && !h.bpNo.includes(filterBP)) return false;
      if (filterHouse && !h.houseNo.toLowerCase().includes(filterHouse.toLowerCase())) return false;
      if (filterMeter && !h.meterNo.includes(filterMeter)) return false;
      return true;
    });
  }, [filterAcct, filterArea, filterBP, filterHouse, filterMeter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function reset() { setPage(1); }

  return (
    <div>
      {/* Toggle */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-0 rounded-lg overflow-hidden border" style={{ borderColor: '#2d6a27' }}>
          <button
            onClick={() => { setView('houses'); reset(); }}
            className="px-4 py-2 text-sm font-semibold transition-all flex items-center gap-2"
            style={view === 'houses'
              ? { background: '#2d6a27', color: 'white' }
              : { background: 'white', color: '#2d6a27' }
            }
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            </svg>
            House Connections
          </button>
          <button
            onClick={() => { setView('stock'); reset(); }}
            className="px-4 py-2 text-sm font-semibold transition-all flex items-center gap-2 border-l"
            style={view === 'stock'
              ? { background: '#2d6a27', color: 'white', borderColor: '#2d6a27' }
              : { background: 'white', color: '#2d6a27', borderColor: '#2d6a27' }
            }
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
            Stock Status
          </button>
        </div>

        <button
          onClick={() => exportHouseData(filtered)}
          className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
          style={{ background: '#2d6a27' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export Excel
        </button>
      </div>

      {view === 'houses' ? (
        <>
          {/* Filters */}
          <div className="card p-4 mb-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                value={filterAcct}
                onChange={e => { setFilterAcct(e.target.value); reset(); }}
                className="px-3 py-2.5 rounded-lg border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-green-600"
                style={{ background: '#1f2937', color: 'white', borderColor: '#374151' }}
              >
                <option value="">-- Account Type --</option>
                {acctTypes.map(a => <option key={a}>{a}</option>)}
              </select>
              <select
                className="px-3 py-2.5 rounded-lg border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-green-600"
                style={{ background: '#1f2937', color: 'white', borderColor: '#374151' }}
                defaultValue=""
              >
                <option value="">OXYGEN PROTECH PVT LTD</option>
                {societies.map(s => <option key={s}>{s}</option>)}
              </select>
              <select
                value={filterArea}
                onChange={e => { setFilterArea(e.target.value); reset(); }}
                className="px-3 py-2.5 rounded-lg border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-green-600"
                style={{ background: '#1f2937', color: 'white', borderColor: '#374151' }}
              >
                <option value="">Select Area</option>
                {areas.map(a => <option key={a}>{a}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="BP Number"
                value={filterBP}
                onChange={e => { setFilterBP(e.target.value); reset(); }}
                className="px-3 py-2.5 rounded-lg border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-green-600"
                style={{ background: '#1f2937', color: 'white', borderColor: '#374151' }}
              />
              <input
                type="text"
                placeholder="House No / Address"
                value={filterHouse}
                onChange={e => { setFilterHouse(e.target.value); reset(); }}
                className="px-3 py-2.5 rounded-lg border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-green-600"
                style={{ background: '#1f2937', color: 'white', borderColor: '#374151' }}
              />
              <input
                type="text"
                placeholder="Meter No."
                value={filterMeter}
                onChange={e => { setFilterMeter(e.target.value); reset(); }}
                className="px-3 py-2.5 rounded-lg border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-green-600"
                style={{ background: '#1f2937', color: 'white', borderColor: '#374151' }}
              />
            </div>
          </div>

          {/* Showing info */}
          <p className="text-sm text-gray-500 mb-2">
            Showing page {page} of {totalPages} — {filtered.length} entries
          </p>

          {/* Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#2d6a27' }}>
                    {['Acct', 'BP No.', 'Name', 'Mobile', 'House No.', 'Area', 'City', 'Meter No.', 'Meter Date', 'GC Status', 'GI Status', 'RFC', 'NG Status', 'SARAL', 'Photo', 'Action'].map(col => (
                      <th key={col} className="px-3 py-3 text-left text-xs font-bold text-white whitespace-nowrap">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paged.map((h, i) => (
                    <tr key={h.id} className={`tbl-row border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <td className="px-3 py-2.5 text-xs font-medium text-gray-600 whitespace-nowrap">{h.acctType}</td>
                      <td className="px-3 py-2.5 font-semibold text-gray-800 whitespace-nowrap">{h.bpNo}</td>
                      <td className="px-3 py-2.5 font-bold text-gray-900 whitespace-nowrap">{h.name}</td>
                      <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{h.mobile}</td>
                      <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{h.houseNo}</td>
                      <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{h.area}</td>
                      <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{h.city}</td>
                      <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{h.meterNo}</td>
                      <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{h.meterDate}</td>
                      <td className="px-3 py-2.5"><StatusBadge val={h.gcStatus} /></td>
                      <td className="px-3 py-2.5"><StatusBadge val={h.giStatus} /></td>
                      <td className="px-3 py-2.5"><StatusBadge val={h.rfc} /></td>
                      <td className="px-3 py-2.5"><StatusBadge val={h.ngStatus} /></td>
                      <td className="px-3 py-2.5"><StatusBadge val={h.saralStatus} /></td>
                      <td className="px-3 py-2.5 text-center">
                        {h.meterPhoto
                          ? <span className="text-green-600">✓</span>
                          : <span className="text-red-400">✗</span>
                        }
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => setModalHouse(h)}
                          className="px-3 py-1 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-80 whitespace-nowrap"
                          style={{ background: '#2d6a27' }}
                        >
                          Meter Details
                        </button>
                      </td>
                    </tr>
                  ))}
                  {paged.length === 0 && (
                    <tr>
                      <td colSpan={16} className="px-4 py-10 text-center text-gray-400">
                        No records found matching filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 py-4 px-4 border-t border-gray-100">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium border disabled:opacity-40 hover:bg-gray-50 transition-all"
                  style={{ borderColor: '#2d6a27', color: '#2d6a27' }}
                >
                  ← Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className="w-8 h-8 rounded-lg text-sm font-semibold transition-all"
                    style={p === page
                      ? { background: '#2d6a27', color: 'white' }
                      : { background: 'white', color: '#2d6a27', border: '1px solid #2d6a27' }
                    }
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium border disabled:opacity-40 hover:bg-gray-50 transition-all"
                  style={{ borderColor: '#2d6a27', color: '#2d6a27' }}
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="card p-8 flex items-center justify-center text-gray-400">
          <p>Switch to <strong className="text-gray-700">Stock Status</strong> view is shown in the Inventory page. <br/>
          Use the top nav to go to <strong className="text-gray-700">Inventory</strong>.</p>
        </div>
      )}

      {/* Meter Modal */}
      {modalHouse && (
        <MeterModal
          house={modalHouse}
          onClose={() => setModalHouse(null)}
          onSave={(data) => {
            console.log('Saved meter data:', data);
            setModalHouse(null);
          }}
        />
      )}
    </div>
  );
}
