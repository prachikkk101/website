// src/components/HouseTable.jsx
import { useState, useMemo, useRef } from 'react';
import { useSite } from '../context/SiteContext';
import { useToast } from './Toast';
import SlidePanel from './SlidePanel';
import { areas, societies, acctTypes } from '../data/houses';
import MeterModal from './MeterModal';
import { exportHouseData } from '../utils/exportExcel';

/* ── Status Badge ── */
const STATUS_MAP = {
  'Done':        'badge-done',
  'Done 3.0':    'badge-done',
  'Done 3.0 MTR': 'badge-done',
  'Done 3.5 MTR': 'badge-done',
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

const PANEL_AREAS = [
  'UE-II',
  'PLA',
  'Guru Nanak Nagar',
  'Uttam Nagar',
  'Sector 12',
  'Model Town',
  'Kishangar Village'
];

const initialForm = {
  bpNo: '',
  appNo: '',
  name: '',
  mobile: '',
  altMobile: '',
  acctType: '',
  houseNo: '',
  address1: '',
  area: 'PLA',
  city: 'HISAR',
  gcStatus: '—',
  giStatus: '—',
  rfc: '—',
  ngStatus: '—',
  saralStatus: '—',
  plumbingDate: '',
  gcLength: '',
  giLength: '',
  tfCount: '',
  ivCount: '',
  meterNo: '',
  meterDate: '',
  meterMake: '',
  meterReading: 0,
  side: 'LHS',
  photo: null
};

const initialMaterials = {
  '20mm PE Pipe (mtr)': 0,
  "½'' GI Pipe (mtr)": 0,
  'TF Fitting': 0,
  'Isolation Ball Valve': 0,
  '32mm Coupler': 0,
  '63mm Coupler': 0,
  'Teflon Tape (rolls)': 0,
  'Gas Tap': 0,
  'Rubber Tube (mtr)': 0,
  'Hose Clamp': 0,
};

export default function HouseTable() {
  const { houses, setHouses, stock, setStock } = useSite();
  const { showToast } = useToast();

  const [view,          setView]          = useState('houses');
  const [filterAcct,    setFilterAcct]    = useState('');
  const [filterArea,    setFilterArea]    = useState('');
  const [filterSociety, setFilterSociety] = useState('');
  const [filterBP,      setFilterBP]      = useState('');
  const [page,          setPage]          = useState(1);
  const [modalHouse,    setModalHouse]    = useState(null);

  // Export dates default to today
  const todayStr = new Date().toISOString().split('T')[0];
  const [exportFrom, setExportFrom] = useState(todayStr);
  const [exportTo,   setExportTo]   = useState(todayStr);

  // Add Entry Panel State
  const [panelOpen, setPanelOpen] = useState(false);
  const [formData, setFormData] = useState(initialForm);
  const [materials, setMaterials] = useState(initialMaterials);
  const [errors, setErrors] = useState({});

  const cameraRef = useRef();
  const galleryRef = useRef();

  function reset() { setPage(1); }

  const filtered = useMemo(() => {
    return houses.filter(h => {
      if (filterAcct  && h.acctType.toUpperCase() !== filterAcct.toUpperCase()) return false;
      if (filterArea  && h.area !== filterArea)  return false;
      if (filterSociety && h.society !== filterSociety && !h.name.includes(filterSociety)) return false;
      if (filterBP    && !h.bpNo.includes(filterBP)) return false;
      return true;
    });
  }, [houses, filterAcct, filterArea, filterSociety, filterBP]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged      = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleSave() {
    // Validate required fields
    const newErrors = {};
    if (!formData.bpNo.trim()) newErrors.bpNo = 'BP Number is required';
    if (!formData.name.trim()) newErrors.name = 'Customer Name is required';
    if (!formData.mobile.trim()) newErrors.mobile = 'Mobile Number is required';
    if (!formData.acctType) newErrors.acctType = 'Account Type is required';
    if (!formData.houseNo.trim()) newErrors.houseNo = 'House No. is required';

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      showToast('⚠️ Please fill in all required fields');
      return;
    }

    // Add new entry
    const newEntry = {
      id: Date.now(),
      acctType: formData.acctType.toUpperCase(),
      bpNo: formData.bpNo,
      applicationNo: formData.appNo,
      name: formData.name,
      mobile: formData.mobile,
      alternateMobile: formData.altMobile,
      houseNo: formData.houseNo,
      address1: formData.address1,
      area: formData.area,
      city: formData.city || 'HISAR',
      gcStatus: formData.gcStatus,
      giStatus: formData.giStatus,
      rfc: formData.rfc,
      ngStatus: formData.ngStatus,
      saralStatus: formData.saralStatus,
      plumbingDate: formData.plumbingDate,
      gcLength: formData.gcLength,
      giLength: formData.giLength,
      tfCount: formData.tfCount,
      ivCount: formData.ivCount,
      meterNo: formData.meterNo || '-',
      meterDate: formData.meterDate || '-',
      meterMake: formData.meterMake,
      meterReading: formData.meterReading,
      side: formData.side,
      meterPhoto: !!formData.photo,
      entryDate: new Date().toISOString().split('T')[0],
      site: 'Khanna CA-09'
    };

    setHouses([newEntry, ...houses]);

    // Deduct stock
    setStock(prevStock => prevStock.map(item => {
      const qty = Number(materials[item.mat] || 0);
      if (qty > 0) {
        return {
          ...item,
          issued: item.issued + qty,
          onSite: Math.max(0, item.onSite - qty)
        };
      }
      return item;
    }));

    // Reset and close
    setFormData(initialForm);
    setMaterials(initialMaterials);
    setErrors({});
    setPanelOpen(false);
    showToast('✓ Entry saved successfully');
  }

  function handleCancel() {
    setFormData(initialForm);
    setMaterials(initialMaterials);
    setErrors({});
    setPanelOpen(false);
  }

  return (
    <div>
      {/* ── Title Heading ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1f4e1a', margin: 0 }}>
          {view === 'houses' ? 'House Connections' : 'Stock Status'}
        </h1>
        {view === 'houses' && (
          <button
            onClick={() => setPanelOpen(true)}
            className="btn btn-primary"
            style={{ background: '#2d6a27', color: 'white', padding: '0 20px', height: 36, fontSize: 13, borderRadius: 6, fontWeight: 600 }}
          >
            + Add New Entry
          </button>
        )}
      </div>

      {/* ── Toggle + Export ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 12 }}>
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

        {/* Date inputs for Export */}
        {view === 'houses' && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#475569', fontWeight: 500 }}>Export entries from</span>
            <input
              type="date"
              className="gp-input"
              style={{ height: 32, fontSize: 12 }}
              value={exportFrom}
              onChange={e => setExportFrom(e.target.value)}
            />
            <span style={{ fontSize: 12, color: '#475569', fontWeight: 500 }}>to</span>
            <input
              type="date"
              className="gp-input"
              style={{ height: 32, fontSize: 12 }}
              value={exportTo}
              onChange={e => setExportTo(e.target.value)}
            />
            <button
              onClick={() => exportHouseData(filtered, exportFrom, exportTo)}
              className="btn btn-outline"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export Excel
            </button>
          </div>
        )}
      </div>

      {view === 'houses' ? (
        <>
          {/* ── Filter Bar ── */}
          <div className="card section-block" style={{ padding: '10px 14px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <select
                className="gp-select-dark"
                style={{ width: 160 }}
                value={filterAcct}
                onChange={e => { setFilterAcct(e.target.value); reset(); }}
              >
                <option value="">-- Account Type --</option>
                {acctTypes.map(a => <option key={a}>{a}</option>)}
              </select>

              <select
                className="gp-select-dark"
                style={{ width: 160 }}
                value={filterArea}
                onChange={e => { setFilterArea(e.target.value); reset(); }}
              >
                <option value="">-- Select Area --</option>
                {areas.map(a => <option key={a}>{a}</option>)}
              </select>

              <select
                className="gp-select-dark"
                style={{ width: 180 }}
                value={filterSociety}
                onChange={e => { setFilterSociety(e.target.value); reset(); }}
              >
                <option value="">-- Select Society --</option>
                {societies.map(s => <option key={s}>{s}</option>)}
              </select>

              <input
                className="gp-input-dark"
                style={{ width: 150 }}
                placeholder="BP Number"
                value={filterBP}
                onChange={e => { setFilterBP(e.target.value); reset(); }}
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

      {/* ── Add Entry Panel ── */}
      <SlidePanel
        isOpen={panelOpen}
        onClose={handleCancel}
        title="Add House Connection Entry"
      >
        {/* Section 1 */}
        <div>
          <div className="panel-section-title">Section 1 — Customer Details</div>
          <div className="panel-field">
            <label className="panel-label">BP Number* <span style={{fontWeight: 400, color: '#6b7280'}}>(Unique identifier)</span></label>
            <input
              type="text"
              className={`panel-input${errors.bpNo ? ' error' : ''}`}
              value={formData.bpNo}
              onChange={e => setFormData({ ...formData, bpNo: e.target.value })}
              placeholder="Unique identifier"
            />
            {errors.bpNo && <p className="panel-error-text">{errors.bpNo}</p>}
          </div>

          <div className="panel-field">
            <label className="panel-label">Application No.</label>
            <input
              type="text"
              className="panel-input"
              value={formData.appNo}
              onChange={e => setFormData({ ...formData, appNo: e.target.value })}
              placeholder="Application No."
            />
          </div>

          <div className="panel-field">
            <label className="panel-label">Customer Name*</label>
            <input
              type="text"
              className={`panel-input${errors.name ? ' error' : ''}`}
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="Customer Name"
            />
            {errors.name && <p className="panel-error-text">{errors.name}</p>}
          </div>

          <div className="panel-field">
            <label className="panel-label">Mobile Number*</label>
            <input
              type="text"
              className={`panel-input${errors.mobile ? ' error' : ''}`}
              value={formData.mobile}
              onChange={e => setFormData({ ...formData, mobile: e.target.value })}
              placeholder="Mobile Number"
            />
            {errors.mobile && <p className="panel-error-text">{errors.mobile}</p>}
          </div>

          <div className="panel-field">
            <label className="panel-label">Alternate Mobile</label>
            <input
              type="text"
              className="panel-input"
              value={formData.altMobile}
              onChange={e => setFormData({ ...formData, altMobile: e.target.value })}
              placeholder="Alternate Mobile"
            />
          </div>

          <div className="panel-field">
            <label className="panel-label">Account Type*</label>
            <select
              className={`panel-select${errors.acctType ? ' error' : ''}`}
              value={formData.acctType}
              onChange={e => setFormData({ ...formData, acctType: e.target.value })}
            >
              <option value="">Select Account Type</option>
              {acctTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            {errors.acctType && <p className="panel-error-text">{errors.acctType}</p>}
          </div>
        </div>

        {/* Section 2 */}
        <div>
          <div className="panel-section-title">Section 2 — Address</div>
          <div className="panel-field">
            <label className="panel-label">House No.*</label>
            <input
              type="text"
              className={`panel-input${errors.houseNo ? ' error' : ''}`}
              value={formData.houseNo}
              onChange={e => setFormData({ ...formData, houseNo: e.target.value })}
              placeholder="House No."
            />
            {errors.houseNo && <p className="panel-error-text">{errors.houseNo}</p>}
          </div>

          <div className="panel-field">
            <label className="panel-label">Address Line 1</label>
            <input
              type="text"
              className="panel-input"
              value={formData.address1}
              onChange={e => setFormData({ ...formData, address1: e.target.value })}
              placeholder="Address Line 1"
            />
          </div>

          <div className="panel-field">
            <label className="panel-label">Area</label>
            <select
              className="panel-select"
              value={formData.area}
              onChange={e => setFormData({ ...formData, area: e.target.value })}
            >
              {PANEL_AREAS.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          <div className="panel-field">
            <label className="panel-label">City</label>
            <input
              type="text"
              className="panel-input"
              value={formData.city}
              onChange={e => setFormData({ ...formData, city: e.target.value })}
            />
          </div>
        </div>

        {/* Section 3 */}
        <div>
          <div className="panel-section-title">Section 3 — Work Status</div>
          <div className="panel-field">
            <label className="panel-label">GC Status</label>
            <select
              className="panel-select"
              value={formData.gcStatus}
              onChange={e => setFormData({ ...formData, gcStatus: e.target.value })}
            >
              {['—', 'Done', 'Pending', 'Done 3.0 MTR', 'Done 3.5 MTR'].map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>

          <div className="panel-field">
            <label className="panel-label">GI Status</label>
            <select
              className="panel-select"
              value={formData.giStatus}
              onChange={e => setFormData({ ...formData, giStatus: e.target.value })}
            >
              {['—', 'Done', 'Pending'].map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>

          <div className="panel-field">
            <label className="panel-label">RFC Status</label>
            <select
              className="panel-select"
              value={formData.rfc}
              onChange={e => setFormData({ ...formData, rfc: e.target.value })}
            >
              {['—', 'Done', 'RFC', 'Pending'].map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>

          <div className="panel-field">
            <label className="panel-label">NG Status</label>
            <select
              className="panel-select"
              value={formData.ngStatus}
              onChange={e => setFormData({ ...formData, ngStatus: e.target.value })}
            >
              {['—', 'Done', 'NG Done', 'RFC', 'Pending'].map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>

          <div className="panel-field">
            <label className="panel-label">SARAL Status</label>
            <select
              className="panel-select"
              value={formData.saralStatus}
              onChange={e => setFormData({ ...formData, saralStatus: e.target.value })}
            >
              {['—', 'DONE', 'NG PENDING', 'METER NOT UPDATE', 'Prepaid Meter'].map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>

          <div className="panel-field">
            <label className="panel-label">Plumbing Date</label>
            <input
              type="date"
              className="panel-input"
              value={formData.plumbingDate}
              onChange={e => setFormData({ ...formData, plumbingDate: e.target.value })}
            />
          </div>

          <div className="panel-field">
            <label className="panel-label">GC Total Length in metres</label>
            <input
              type="number"
              className="panel-input"
              placeholder="0"
              value={formData.gcLength}
              onChange={e => setFormData({ ...formData, gcLength: e.target.value })}
            />
          </div>

          <div className="panel-field">
            <label className="panel-label">GI Pipe length in metres</label>
            <input
              type="number"
              className="panel-input"
              placeholder="0"
              value={formData.giLength}
              onChange={e => setFormData({ ...formData, giLength: e.target.value })}
            />
          </div>

          <div className="panel-field">
            <label className="panel-label">TF count</label>
            <input
              type="number"
              className="panel-input"
              placeholder="0"
              value={formData.tfCount}
              onChange={e => setFormData({ ...formData, tfCount: e.target.value })}
            />
          </div>

          <div className="panel-field">
            <label className="panel-label">IV count</label>
            <input
              type="number"
              className="panel-input"
              placeholder="0"
              value={formData.ivCount}
              onChange={e => setFormData({ ...formData, ivCount: e.target.value })}
            />
          </div>
        </div>

        {/* Section 4 */}
        <div>
          <div className="panel-section-title">Section 4 — Meter Details</div>
          <div className="panel-field">
            <label className="panel-label">Meter No.</label>
            <input
              type="text"
              className="panel-input"
              placeholder="Meter No."
              value={formData.meterNo}
              onChange={e => setFormData({ ...formData, meterNo: e.target.value })}
            />
          </div>

          <div className="panel-field">
            <label className="panel-label">Meter Date</label>
            <input
              type="date"
              className="panel-input"
              value={formData.meterDate}
              onChange={e => setFormData({ ...formData, meterDate: e.target.value })}
            />
          </div>

          <div className="panel-field">
            <label className="panel-label">Meter Make</label>
            <select
              className="panel-select"
              value={formData.meterMake}
              onChange={e => setFormData({ ...formData, meterMake: e.target.value })}
            >
              <option value="">Select Make</option>
              {['Itron', 'Elster', 'Honeywell', 'Landis+Gyr'].map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="panel-field">
            <label className="panel-label">Meter Reading</label>
            <input
              type="number"
              className="panel-input"
              value={formData.meterReading}
              onChange={e => setFormData({ ...formData, meterReading: Number(e.target.value) })}
            />
          </div>

          <div className="panel-field">
            <label className="panel-label">Side</label>
            <div style={{ display: 'flex', gap: 16 }}>
              {['LHS', 'RHS'].map(side => (
                <label key={side} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                  <input
                    type="radio"
                    name="side"
                    checked={formData.side === side}
                    onChange={() => setFormData({ ...formData, side })}
                    style={{ cursor: 'pointer' }}
                  />
                  {side}
                </label>
              ))}
            </div>
          </div>

          <div className="panel-field">
            <label className="panel-label">Meter Photo Upload</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => cameraRef.current.click()}
                className="panel-btn-cancel"
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                📷 Take Photo
              </button>
              <button
                type="button"
                onClick={() => galleryRef.current.click()}
                className="panel-btn-cancel"
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                🖼 Import from Gallery
              </button>
            </div>
            <input
              type="file"
              ref={cameraRef}
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={e => {
                if (e.target.files[0]) setFormData({ ...formData, photo: e.target.files[0] });
              }}
            />
            <input
              type="file"
              ref={galleryRef}
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => {
                if (e.target.files[0]) setFormData({ ...formData, photo: e.target.files[0] });
              }}
            />
            {formData.photo && (
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <img
                  src={URL.createObjectURL(formData.photo)}
                  alt="Preview"
                  style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, border: '1px solid #d1d5db' }}
                />
                <span style={{ fontSize: 11, color: '#4b5563', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {formData.photo.name}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Section 5 */}
        <div>
          <div className="panel-section-title">Section 5 — Materials Used</div>
          <p style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic', marginBottom: 12 }}>
            "Quantities entered here will be automatically deducted from the site stock"
          </p>

          {Object.keys(materials).map(matName => (
            <div className="panel-field" key={matName} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <label className="panel-label" style={{ margin: 0, flex: 1 }}>{matName}</label>
              <input
                type="number"
                className="panel-input"
                style={{ width: 100 }}
                min={0}
                value={materials[matName]}
                onChange={e => setMaterials({ ...materials, [matName]: Number(e.target.value) })}
              />
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="panel-footer" style={{ margin: '0 -20px -20px', padding: '14px 20px' }}>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>* Required fields</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleCancel} className="panel-btn-cancel">Cancel</button>
            <button onClick={handleSave} className="panel-btn-save">Save Entry</button>
          </div>
        </div>
      </SlidePanel>
    </div>
  );
}
