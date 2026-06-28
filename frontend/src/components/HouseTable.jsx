// src/components/HouseTable.jsx
import { useState, useMemo, useEffect, useContext } from 'react';
import { houses as defaultHouses } from '../data/houses';
import MeterModal from './MeterModal';
import defaultStockData from '../data/stockData';
import { exportHouseData } from '../utils/exportExcel';
import SlidePanel, { Field, Input, Select, SectionTitle } from './SlidePanel';
import { useToast } from './Toast';
import { AuthContext } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';

/* ── Helpers ── */
function initStore(key, defaults) {
  try {
    const raw = localStorage.getItem('gppms_' + key);
    if (!raw) { localStorage.setItem('gppms_' + key, JSON.stringify(defaults)); return defaults; }
    return JSON.parse(raw);
  } catch { return defaults; }
}

function getSession() {
  try { return JSON.parse(localStorage.getItem('gppms_session') || '{}'); } catch { return {}; }
}

const todayStr = () => new Date().toISOString().split('T')[0];

function formatDate(d) {
  if (!d || d === '-') return '—';
  try {
    const date = new Date(d);
    if (isNaN(date)) return d;
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return d; }
}

/* ── Status Badge ── */
const STATUS_MAP = {
  'Done':'badge-done','Done 3.0':'badge-done','Done 3.5':'badge-done',
  'Pending':'badge-pending','Not Updated':'badge-updated','RFC':'badge-rfc',
};
function StatusBadge({ val }) {
  if (!val || val === '-' || val === '—') return <span style={{ color: '#cbd5e1' }}>—</span>;
  const cls = STATUS_MAP[val] ?? 'badge-done';
  return <span className={`badge ${cls}`}>{val}</span>;
}

const PAGE_SIZE = 8;
const AREAS_LIST    = ['UE-II','PLA','Guru Nanak Nagar','Uttam Nagar','Sector 12','Model Town','Kishangar Village','Market'];
const ACCT_TYPES    = ['Domestic','Commercial','Industrial'];
const GC_STATUSES   = ['—','Done','Pending','Done 3.0 MTR','Done 3.5 MTR'];
const GI_STATUSES   = ['—','Done','Pending'];
const RFC_STATUSES  = ['—','Done','RFC','Pending'];
const NG_STATUSES   = ['—','Done','NG Done','RFC','Pending'];
const SARAL_STATUSES= ['—','DONE','NG PENDING','METER NOT UPDATE','Prepaid Meter'];
const METER_MAKES   = ['Select','Itron','Elster','Honeywell','Landis+Gyr'];
const MATERIALS     = [
  { key: 'pe20',      label: "20mm PE Pipe",          unit: 'mtr'  },
  { key: 'gi12',      label: "½\" GI Pipe",           unit: 'mtr'  },
  { key: 'tfFit',     label: 'TF Fitting',            unit: 'pcs'  },
  { key: 'ibv',       label: 'Isolation Ball Valve',  unit: 'pcs'  },
  { key: 'c32',       label: '32mm Coupler',          unit: 'pcs'  },
  { key: 'c63',       label: '63mm Coupler',          unit: 'pcs'  },
  { key: 'teflon',    label: 'Teflon Tape (rolls)',   unit: 'rolls' },
  { key: 'gasTap',    label: 'Gas Tap',               unit: 'pcs'  },
  { key: 'rubber',    label: 'Rubber Tube',           unit: 'mtr'  },
  { key: 'hoseClamp', label: 'Hose Clamp',            unit: 'pcs'  },
];

const EMPTY_FORM = {
  bpNo:'', appNo:'', name:'', mobile:'', altMobile:'',
  acctType:'Domestic', houseNo:'', address1:'', area:'UE-II', city:'HISAR',
  gcStatus:'—', giStatus:'—', rfc:'—', ngStatus:'—', saralStatus:'—',
  plumbingDate:'', gcLen:'', giLen:'', tf:'', iv:'',
  meterNo:'', meterDate:'', meterMake:'Select', meterReading:0, side:'LHS', meterPhotoFile:null,
  pe20:0, gi12:0, tfFit:0, ibv:0, c32:0, c63:0, teflon:0, gasTap:0, rubber:0, hoseClamp:0,
};

/* ── Delete Confirm Modal ── */
function ConfirmDelete({ onConfirm, onCancel }) {
  return (
    <div style={{ position:'fixed',inset:0,zIndex:1100,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}>
      <div style={{ background:'#fff',borderRadius:12,padding:28,maxWidth:360,width:'100%',boxShadow:'0 20px 60px rgba(0,0,0,0.25)',textAlign:'center' }}>
        <div style={{ fontSize:36,marginBottom:12 }}>🗑</div>
        <p style={{ fontSize:15,fontWeight:700,color:'#1e293b',marginBottom:6 }}>Delete this entry permanently?</p>
        <p style={{ fontSize:12,color:'#64748b',marginBottom:20 }}>This action cannot be undone.</p>
        <div style={{ display:'flex',gap:10 }}>
          <button onClick={onCancel} style={{ flex:1,height:38,background:'#f1f5f9',border:'1px solid #d1d5db',borderRadius:7,fontSize:13,fontWeight:600,cursor:'pointer',color:'#374151' }}>
            Cancel
          </button>
          <button onClick={onConfirm} style={{ flex:1,height:38,background:'#c0440a',border:'none',borderRadius:7,fontSize:13,fontWeight:600,cursor:'pointer',color:'#fff' }}>
            Yes, Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HouseTable() {
  const { showToast } = useToast();
  const { user }      = useContext(AuthContext);
  const { selectedSite } = useSite();
  const [allHouses, setAllHouses] = useState([]);

  useEffect(() => {
    document.title = 'GP-PMS — PNG Connections';
    setAllHouses(initStore('houses', defaultHouses));
  }, []);

  // Auth / role checks
  const session    = getSession();
  const isSupervisor = user?.role === 'SUPERVISOR';
  const siteAccess   = session.siteAccess;
  const isAdmin      = (
    user?.role === 'ADMIN' || user?.role === 'admin' ||
    ['oxygenhisar@gmail.com', 'oxygenprotech@gmail.com', 'admin@gppms.com']
      .includes((session.email || '').toLowerCase())
  );
  const isViewOnly   = !isAdmin && (!siteAccess || siteAccess === 'none' || siteAccess === null);
  const canWrite     = !isViewOnly;

  const [filterAcct, setFilterAcct] = useState('');
  const [filterArea, setFilterArea] = useState('');
  const [filterBP,   setFilterBP]   = useState('');
  const [page,       setPage]       = useState(1);
  const [modalHouse, setModalHouse] = useState(null);

  // Export state — default from 2020 to capture all historical data
  const [exportFrom,   setExportFrom]   = useState('2020-01-01');
  const [exportTo,     setExportTo]     = useState(todayStr());
  const [exportFilter, setExportFilter] = useState('all');

  // Add/Edit panel
  const [panelOpen,    setPanelOpen]    = useState(false);
  const [editEntry,    setEditEntry]    = useState(null); // null => add mode, object => edit mode
  const [form,         setForm]         = useState(EMPTY_FORM);
  const [errors,       setErrors]       = useState({});
  const [photoName,    setPhotoName]    = useState('');
  const [showDelete,   setShowDelete]   = useState(false);

  function reset() { setPage(1); }
  const f = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const filtered = useMemo(() => (allHouses || []).filter(h => {
    if (filterAcct && h.acctType !== filterAcct) return false;
    if (filterArea && h.area    !== filterArea)  return false;
    if (filterBP   && !String(h.bpNo || '').includes(filterBP)) return false;
    return true;
  }), [allHouses, filterAcct, filterArea, filterBP]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const paged      = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  /* ── isDone / isPending helpers ── */
  function isDone(h) {
    const gc    = (h.gc    || h.gcStatus    || '').toLowerCase();
    const gi    = (h.gi    || h.giStatus    || '').toLowerCase();
    const rfc   = (h.rfc   || h.rfcStatus   || '').toLowerCase();
    const ng    = (h.ng    || h.ngStatus    || '').toLowerCase();
    const saral = (h.saral || h.saralStatus || '').toLowerCase();
    const meter = String(h.meter || h.meterNo || h.meterNumber || '');
    return (
      gc.includes('done') &&
      gi.includes('done') &&
      rfc.includes('done') &&
      ng.includes('done') &&
      saral === 'done' &&
      meter !== '' && meter !== '-' && meter !== '–' && meter !== 'null'
    );
  }

  /* ── Date-match helper — lenient (include if no date field) ── */
  function dateMatches(h) {
    const dateStr = h.createdAt || h.meterDate || h.plumbingDate || h.date || null;
    if (!dateStr) return true; // no date → always include
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return true;
      const from = new Date(exportFrom); from.setHours(0,0,0,0);
      const to   = new Date(exportTo);   to.setHours(23,59,59,999);
      return d >= from && d <= to;
    } catch { return true; }
  }

  /* ── Compute export-preview counts ── */
  const exportPreview = useMemo(() => {
    const inRange = (allHouses || []).filter(dateMatches);
    const doneCount    = inRange.filter(isDone).length;
    const pendingCount = inRange.length - doneCount;
    return { total: inRange.length, done: doneCount, pending: pendingCount };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allHouses, exportFrom, exportTo]);

  /* ── Export with Done/Pending filter ── */
  function handleExport() {
    let data = (allHouses || []).filter(dateMatches);

    if (exportFilter === 'done')    data = data.filter(isDone);
    else if (exportFilter === 'pending') data = data.filter(h => !isDone(h));

    console.log('Exporting', data.length, 'rows with filter:', exportFilter);

    const suffix = exportFilter === 'all'
      ? `All_${exportFrom}_to_${exportTo}`
      : `${exportFilter.charAt(0).toUpperCase() + exportFilter.slice(1)}_${exportFrom}_to_${exportTo}`;

    exportHouseData(data, exportFrom, exportTo, exportFilter, suffix);
  }

  /* ── Validate ── */
  function validateForm() {
    const e = {};
    if (!form.bpNo.trim())    e.bpNo    = 'Required';
    if (!form.name.trim())    e.name    = 'Required';
    if (!form.mobile.trim())  e.mobile  = 'Required';
    if (!form.houseNo.trim()) e.houseNo = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  /* ── Open Add panel ── */
  function openAddPanel() {
    setEditEntry(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setPhotoName('');
    setPanelOpen(true);
  }

  /* ── Open Edit panel ── */
  function openEditPanel(h) {
    setEditEntry(h);
    setForm({
      bpNo: h.bpNo || '', appNo: h.appNo || '', name: h.name || '',
      mobile: h.mobile || '', altMobile: h.altMobile || '',
      acctType: h.acctType || 'Domestic',
      houseNo: h.houseNo || '', address1: h.address1 || '',
      area: h.area || 'UE-II', city: h.city || 'HISAR',
      gcStatus: h.gcStatus || '—', giStatus: h.giStatus || '—',
      rfc: h.rfc || '—', ngStatus: h.ngStatus || '—', saralStatus: h.saralStatus || '—',
      plumbingDate: h.plumbingDate || '', gcLen: h.gcLen || '',
      giLen: h.giLen || '', tf: h.tf || '', iv: h.iv || '',
      meterNo: h.meterNo || '', meterDate: h.meterDate || '',
      meterMake: h.meterMake || 'Select', meterReading: h.meterReading || 0,
      side: h.side || 'LHS', meterPhotoFile: null,
      pe20:0, gi12:0, tfFit:0, ibv:0, c32:0, c63:0, teflon:0, gasTap:0, rubber:0, hoseClamp:0,
    });
    setErrors({});
    setPhotoName('');
    setShowDelete(false);
    setPanelOpen(true);
  }

  /* ── Save (add or update) ── */
  function handleSave() {
    if (!validateForm()) return;

    if (editEntry) {
      // Update existing
      const updated = (allHouses || []).map(h =>
        h.id === editEntry.id
          ? {
              ...h,
              bpNo: form.bpNo, appNo: form.appNo, name: form.name,
              mobile: form.mobile, altMobile: form.altMobile,
              acctType: form.acctType, houseNo: form.houseNo,
              address1: form.address1, area: form.area, city: form.city,
              gcStatus: form.gcStatus, giStatus: form.giStatus,
              rfc: form.rfc, ngStatus: form.ngStatus, saralStatus: form.saralStatus,
              plumbingDate: form.plumbingDate, meterNo: form.meterNo,
              meterDate: form.meterDate, meterMake: form.meterMake,
              meterReading: form.meterReading, side: form.side,
              meterPhoto: form.meterPhotoFile ? true : h.meterPhoto,
              updatedAt: new Date().toISOString(),
            }
          : h
      );
      setAllHouses(updated);
      localStorage.setItem('gppms_houses', JSON.stringify(updated));
      setPanelOpen(false);
      setEditEntry(null);
      showToast('✓ Entry updated successfully');
    } else {
      // Add new
      const newEntry = {
        id: Date.now(), bpNo: form.bpNo, name: form.name, mobile: form.mobile,
        appNo: form.appNo, altMobile: form.altMobile,
        acctType: form.acctType, houseNo: form.houseNo,
        address1: form.address1, area: form.area, city: form.city,
        meterNo: form.meterNo, meterDate: form.meterDate,
        meterMake: form.meterMake, meterReading: form.meterReading,
        gcStatus: form.gcStatus, giStatus: form.giStatus,
        rfc: form.rfc, ngStatus: form.ngStatus, saralStatus: form.saralStatus,
        plumbingDate: form.plumbingDate, side: form.side,
        meterPhoto: !!form.meterPhotoFile, createdAt: new Date().toISOString(),
      };
      const updated = [newEntry, ...(allHouses || [])];
      setAllHouses(updated);
      localStorage.setItem('gppms_houses', JSON.stringify(updated));

      // Deduct stock
      try {
        const currentStockRaw = localStorage.getItem('gppms_stock');
        let currentStock = currentStockRaw ? JSON.parse(currentStockRaw) : defaultStockData;
        const materialMapping = {
          pe20: '25mm MDPE Pipe', gi12: 'GI Nipple 25mm',
          tfFit: 'Compression Fitting 25mm', ibv: 'Ball Valve 25mm',
          c32: 'Tee 32mm', c63: 'PE Saddle 63×25mm',
          teflon: 'Reducer 32×25mm', gasTap: 'Pressure Regulator',
          rubber: 'Gas Hose Pipe (1mtr)', hoseClamp: 'Compression Fitting 25mm',
        };
        const updatedStock = currentStock.map(item => {
          let qtyToDeduct = 0;
          Object.entries(materialMapping).forEach(([formKey, stockName]) => {
            if (item.mat === stockName || item.material === stockName)
              qtyToDeduct += Number(form[formKey]) || 0;
          });
          if (qtyToDeduct > 0) {
            return { ...item, issued: (item.issued||0) + qtyToDeduct, onSite: Math.max(0,(item.onSite||0) - qtyToDeduct) };
          }
          return item;
        });
        localStorage.setItem('gppms_stock', JSON.stringify(updatedStock));
      } catch(err) { console.error('Stock deduction error:', err); }

      setPanelOpen(false); setForm(EMPTY_FORM); setErrors({}); setPhotoName('');
      showToast('✓ Entry saved successfully');
    }
  }

  /* ── Delete entry ── */
  function handleDelete() {
    if (!editEntry) return;
    const updated = (allHouses || []).filter(h => h.id !== editEntry.id);
    setAllHouses(updated);
    localStorage.setItem('gppms_houses', JSON.stringify(updated));
    setPanelOpen(false);
    setEditEntry(null);
    setShowDelete(false);
    showToast('✓ Entry deleted');
  }

  const panelTitle = editEntry ? `Edit Entry — ${editEntry.name || 'Entry'}` : 'Add House Connection Entry';

  /* ── Shared form body (used for both add and edit) ── */
  function FormBody() {
    return (
      <>
        <div>
          <SectionTitle>1. Customer Details</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="BP Number" required error={errors.bpNo}><Input value={form.bpNo} onChange={e => f('bpNo', e.target.value)} error={errors.bpNo} /></Field>
            <Field label="Application No."><Input value={form.appNo} onChange={e => f('appNo', e.target.value)} /></Field>
            <Field label="Customer Name" required error={errors.name}><Input value={form.name} onChange={e => f('name', e.target.value)} error={errors.name} /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Mobile" required error={errors.mobile}><Input type="tel" value={form.mobile} onChange={e => f('mobile', e.target.value)} error={errors.mobile} /></Field>
              <Field label="Alt Mobile"><Input type="tel" value={form.altMobile} onChange={e => f('altMobile', e.target.value)} /></Field>
            </div>
            <Field label="Account Type" required><Select value={form.acctType} onChange={e => f('acctType', e.target.value)}>{ACCT_TYPES.map(t => <option key={t}>{t}</option>)}</Select></Field>
          </div>
        </div>
        <div>
          <SectionTitle>2. Address</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="House No." required error={errors.houseNo}><Input value={form.houseNo} onChange={e => f('houseNo', e.target.value)} error={errors.houseNo} /></Field>
            <Field label="Address Line 1"><Input value={form.address1} onChange={e => f('address1', e.target.value)} /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Area"><Select value={form.area} onChange={e => f('area', e.target.value)}>{AREAS_LIST.map(a => <option key={a}>{a}</option>)}</Select></Field>
              <Field label="City"><Input value={form.city} onChange={e => f('city', e.target.value)} /></Field>
            </div>
          </div>
        </div>
        <div>
          <SectionTitle>3. Work Status</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="GC Status"><Select value={form.gcStatus} onChange={e => f('gcStatus', e.target.value)}>{GC_STATUSES.map(s => <option key={s}>{s}</option>)}</Select></Field>
            <Field label="GI Status"><Select value={form.giStatus} onChange={e => f('giStatus', e.target.value)}>{GI_STATUSES.map(s => <option key={s}>{s}</option>)}</Select></Field>
            <Field label="RFC Status"><Select value={form.rfc} onChange={e => f('rfc', e.target.value)}>{RFC_STATUSES.map(s => <option key={s}>{s}</option>)}</Select></Field>
            <Field label="NG Status"><Select value={form.ngStatus} onChange={e => f('ngStatus', e.target.value)}>{NG_STATUSES.map(s => <option key={s}>{s}</option>)}</Select></Field>
            <Field label="SARAL Status"><Select value={form.saralStatus} onChange={e => f('saralStatus', e.target.value)}>{SARAL_STATUSES.map(s => <option key={s}>{s}</option>)}</Select></Field>
            <Field label="Plumbing Date"><Input type="date" value={form.plumbingDate} onChange={e => f('plumbingDate', e.target.value)} /></Field>
          </div>
        </div>
        <div>
          <SectionTitle>4. Meter Details</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Meter No."><Input value={form.meterNo} onChange={e => f('meterNo', e.target.value)} /></Field>
            <Field label="Meter Date"><Input type="date" value={form.meterDate} onChange={e => f('meterDate', e.target.value)} /></Field>
            <Field label="Meter Make"><Select value={form.meterMake} onChange={e => f('meterMake', e.target.value)}>{METER_MAKES.map(m => <option key={m}>{m}</option>)}</Select></Field>
            <Field label="Meter Reading"><Input type="number" min={0} value={form.meterReading} onChange={e => f('meterReading', e.target.value)} /></Field>
          </div>
          <Field label="Side" style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
              {['LHS','RHS'].map(s => (
                <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                  <input type="radio" name="side" value={s} checked={form.side === s} onChange={() => f('side', s)} style={{ accentColor: '#2d6a27' }} />{s}
                </label>
              ))}
            </div>
          </Field>
          <Field label="Meter Photo" style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <label style={{ flex: 1, textAlign: 'center', padding: '8px 4px', border: '1px dashed #d1d5db', borderRadius: 5, fontSize: 12, cursor: 'pointer', background: '#f8fafc' }}>
                📷 Take Photo
                <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => { f('meterPhotoFile', e.target.files[0]); setPhotoName(e.target.files[0]?.name || ''); }} />
              </label>
              <label style={{ flex: 1, textAlign: 'center', padding: '8px 4px', border: '1px dashed #d1d5db', borderRadius: 5, fontSize: 12, cursor: 'pointer', background: '#f8fafc' }}>
                🖼 Gallery
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { f('meterPhotoFile', e.target.files[0]); setPhotoName(e.target.files[0]?.name || ''); }} />
              </label>
            </div>
            {photoName && <p style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>📎 {photoName}</p>}
          </Field>
        </div>
        <div>
          <SectionTitle>5. Materials Used</SectionTitle>
          <p style={{ fontSize: 11, color: '#64748b', marginBottom: 10, background: '#fef3c7', padding: '6px 10px', borderRadius: 4 }}>
            ⚠ Quantities entered here will be deducted from site stock.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {MATERIALS.map(mat => (
              <div key={mat.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <label style={{ flex: 1, fontSize: 12, color: '#374151' }}>{mat.label}</label>
                <span style={{ fontSize: 11, color: '#94a3b8', width: 32 }}>{mat.unit}</span>
                <input type="number" min={0} value={form[mat.key]} onChange={e => f(mat.key, Number(e.target.value))}
                  style={{ width: 80, height: 30, border: '1px solid #d1d5db', borderRadius: 4, padding: '0 8px', fontSize: 13 }} />
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
        {/* Export bar */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>From</span>
          <input type="date" value={exportFrom} onChange={e => setExportFrom(e.target.value)}
            style={{ height: 32, border: '1px solid #d1d5db', borderRadius: 4, padding: '0 8px', fontSize: 12 }} />
          <span style={{ fontSize: 12, color: '#64748b' }}>to</span>
          <input type="date" value={exportTo} onChange={e => setExportTo(e.target.value)}
            style={{ height: 32, border: '1px solid #d1d5db', borderRadius: 4, padding: '0 8px', fontSize: 12 }} />
          <select value={exportFilter} onChange={e => setExportFilter(e.target.value)}
            style={{ height: 32, border: '1px solid #d1d5db', borderRadius: 4, padding: '0 8px', fontSize: 12, background: 'white' }}>
            <option value="all">All Entries</option>
            <option value="done">Done Only</option>
            <option value="pending">Pending Only</option>
          </select>
          <button onClick={handleExport}
            style={{ height: 32, background: '#2d6a27', color: '#fff', border: 'none', borderRadius: 4, padding: '0 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            ↓ Export Excel
          </button>
          {canWrite && (
            <button onClick={openAddPanel}
              style={{ height: 32, background: '#1f4e1a', color: '#fff', border: 'none', borderRadius: 4, padding: '0 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              + Add New Entry
            </button>
          )}
        </div>
      </div>
      <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10, textAlign: 'right' }}>
        Default shows all historical data &nbsp;|&nbsp;
        <span style={{ color: '#16a34a', fontWeight: 600 }}>{exportPreview.done} Done</span>&nbsp;
        / <span style={{ color: '#dc2626', fontWeight: 600 }}>{exportPreview.pending} Pending</span>&nbsp;
        / {exportPreview.total} Total in selected range
      </p>
      {/* Filter bar — Account Type, Area, BP Number only */}
      <div className="card section-block" style={{ padding: '10px 14px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <select className="gp-select-dark" style={{ width: 160 }} value={filterAcct} onChange={e => { setFilterAcct(e.target.value); reset(); }}>
            <option value="">-- Account Type --</option>
            {ACCT_TYPES.map(a => <option key={a}>{a}</option>)}
          </select>
          <select className="gp-select-dark" style={{ width: 160 }} value={filterArea} onChange={e => { setFilterArea(e.target.value); reset(); }}>
            <option value="">All Areas</option>
            {AREAS_LIST.map(a => <option key={a}>{a}</option>)}
          </select>
          <input className="gp-input-dark" style={{ width: 130 }} placeholder="BP Number" value={filterBP} onChange={e => { setFilterBP(e.target.value); reset(); }} />
          <button className="btn btn-primary" onClick={reset}>Search</button>
        </div>
      </div>

      <p style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>
        Showing page {page} of {totalPages} — {filtered.length} entries
      </p>

      {/* Site data label — only when a specific site is selected, NOT GA Dashboard */}
      {selectedSite && selectedSite !== 'all' && selectedSite !== 'ga_dashboard' && (
        <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'#fff0f3', border:'1px solid #f9a8d4', borderRadius:6, padding:'4px 10px', fontSize:11, color:'#be185d', fontWeight:600, marginBottom:8 }}>
          📍 Site data — {SITE_OPTIONS_LABELS[selectedSite] || selectedSite}
        </div>
      )}

      <div className="card section-block" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="gp-table">
            <thead>
              <tr>
                {['Acct','BP No.','Name','Mobile','House No.','Area','City','Meter No.','Meter Date','GC','GI','RFC','NG','SARAL','Photo','Action', canWrite ? '✏' : ''].filter(Boolean).map(c => <th key={c}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr><td colSpan={canWrite ? 17 : 16} style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                  <div style={{ fontSize: 32 }}>📋</div>
                  <div style={{ marginTop: 8, fontSize: 14 }}>No entries found</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Try adjusting your filters or add a new entry</div>
                </td></tr>
              ) : paged.map(h => (
                <tr key={h.id} style={{ cursor: canWrite ? 'default' : 'default' }}>
                  <td style={{ fontSize: 11, color: '#64748b' }}>{h.acctType}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{h.bpNo}</td>
                  <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{h.name}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{h.mobile}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{h.houseNo}</td>
                  <td>{h.area}</td>
                  <td>{h.city}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{h.meterNo}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatDate(h.meterDate)}</td>
                  <td><StatusBadge val={h.gcStatus} /></td>
                  <td><StatusBadge val={h.giStatus} /></td>
                  <td><StatusBadge val={h.rfc} /></td>
                  <td><StatusBadge val={h.ngStatus} /></td>
                  <td><StatusBadge val={h.saralStatus} /></td>
                  <td style={{ textAlign: 'center' }}>{h.meterPhoto ? <span style={{ color: '#16a34a', fontWeight: 700 }}>✓</span> : <span style={{ color: '#dc2626' }}>✗</span>}</td>
                  <td><button onClick={e => { e.stopPropagation(); setModalHouse(h); }} className="btn btn-primary btn-sm" style={{ borderRadius: 4 }}>Meter Details</button></td>
                  {canWrite && (
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={e => { e.stopPropagation(); openEditPanel(h); }}
                        title="Edit entry"
                        style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 4, width: 28, height: 28, cursor: 'pointer', fontSize: 13, color: '#374151', display:'inline-flex', alignItems:'center', justifyContent:'center' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#f0f7ee'; e.currentTarget.style.borderColor = '#2d6a27'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = '#d1d5db'; }}
                      >✏</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

      {modalHouse && <MeterModal house={modalHouse} onClose={() => setModalHouse(null)} onSave={() => setModalHouse(null)} />}

      {/* Add / Edit Entry Panel */}
      <SlidePanel
        isOpen={panelOpen}
        onClose={() => { setPanelOpen(false); setEditEntry(null); setErrors({}); }}
        title={panelTitle}
        onSave={handleSave}
        saveLabel={editEntry ? 'Update Entry' : 'Save Entry'}
        extraFooter={editEntry && (
          <button
            onClick={() => setShowDelete(true)}
            style={{ height:32, background:'#fee2e2', color:'#b91c1c', border:'1px solid #fca5a5', borderRadius:5, padding:'0 14px', fontSize:12, fontWeight:600, cursor:'pointer' }}
          >
            🗑 Delete Entry
          </button>
        )}
      >
        <FormBody />
      </SlidePanel>

      {showDelete && (
        <ConfirmDelete
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </div>
  );
}

// Map site values to labels for display
const SITE_OPTIONS_LABELS = {
  khanna: 'Khanna (CA-09)',
  uenii:  'UE-II — Hisar',
  pla:    'PLA — Hisar',
  kohara: 'Kohara — CA-07',
};
