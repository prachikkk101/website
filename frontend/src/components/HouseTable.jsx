// src/components/HouseTable.jsx
import { useState, useMemo, useEffect, useContext } from 'react';
import { houses as defaultHouses } from '../data/houses';
import MeterModal from './MeterModal';
import defaultStockData from '../data/stockData';
import { exportHouseData } from '../utils/exportExcel';
import SlidePanel, { Field, Input, Select, SectionTitle } from './SlidePanel';
import { useToast } from './Toast';
import { AuthContext } from '../context/AuthContext';
import { useSite, useSiteAreas } from '../context/SiteContext';

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
const AREAS_LIST = [];
const ACCT_TYPES    = ['Domestic','Commercial','Industrial'];
const GC_STATUSES   = ['—','Done','Pending','Done 3.0 MTR','Done 3.5 MTR'];
const GI_STATUSES   = ['—','Done','Pending'];
const RFC_STATUSES  = ['—','Done','RFC','Pending'];
const NG_STATUSES   = ['—','Done','NG Done','RFC','Pending'];
const SARAL_STATUSES= ['—','DONE','NG PENDING','METER NOT UPDATE','Prepaid Meter'];
const METER_MAKES   = ['Select','Itron','Elster','Honeywell','Landis+Gyr'];

// All default/built-in columns — user can hide any of these
const DEFAULT_COLS = [
  { key: 'acct',      label: 'Acct' },
  { key: 'bpNo',      label: 'BP No.' },
  { key: 'name',      label: 'Name' },
  { key: 'mobile',    label: 'Mobile' },
  { key: 'houseNo',   label: 'House No.' },
  { key: 'area',      label: 'Area' },
  { key: 'city',      label: 'City' },
  { key: 'meterNo',   label: 'Meter No.' },
  { key: 'meterDate', label: 'Meter Date' },
  { key: 'gcStatus',  label: 'GC' },
  { key: 'giStatus',  label: 'GI' },
  { key: 'rfc',       label: 'RFC' },
  { key: 'ngStatus',  label: 'NG' },
  { key: 'saralStatus',label: 'SARAL' },
];

const DEFAULT_MATERIALS = [
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

function loadMatList() {
  try {
    const saved = localStorage.getItem('gppms_png_materials');
    return saved ? JSON.parse(saved) : DEFAULT_MATERIALS;
  } catch { return DEFAULT_MATERIALS; }
}

const EMPTY_FORM_BASE = {
  bpNo:'', appNo:'', name:'', mobile:'', altMobile:'',
  acctType:'Domestic', houseNo:'', address1:'', area:'', city:'',
  gcStatus:'—', giStatus:'—', rfc:'—', ngStatus:'—', saralStatus:'—',
  plumbingDate:'', gcLen:'', giLen:'', tf:'', iv:'',
  meterNo:'', meterDate:'', meterMake:'Select', meterReading:0, side:'LHS', meterPhotoFile:null,
};

function makeEmptyForm(matList) {
  const base = { ...EMPTY_FORM_BASE };
  matList.forEach(m => { base[m.key] = 0; });
  return base;
}

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
  const liveAreas = useSiteAreas(); // dynamic areas for selected GA location
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

  const [panelOpen,    setPanelOpen]    = useState(false);
  const [editEntry,    setEditEntry]    = useState(null);
  // Dynamic global materials list (persistent)
  const [matList, setMatList] = useState(() => loadMatList());
  const EMPTY_FORM = makeEmptyForm(matList);
  const [form,         setForm]         = useState(EMPTY_FORM);
  const [errors,       setErrors]       = useState({});
  const [showDelete,   setShowDelete]   = useState(false);
  const [customMaterials, setCustomMaterials] = useState([]); // [{label, unit, qty}] per-entry extras
  const [hiddenMaterials, setHiddenMaterials] = useState([]); // keys hidden for THIS entry only

  // Add a material permanently to the global list
  function addMaterialGlobal() {
    const label = prompt('Enter new material name:');
    if (!label || !label.trim()) return;
    const unit = prompt('Enter unit (e.g. pcs, mtr, rolls):') || 'pcs';
    const newMat = { key: 'cmat_' + Date.now(), label: label.trim(), unit: unit.trim() };
    const updated = [...matList, newMat];
    setMatList(updated);
    localStorage.setItem('gppms_png_materials', JSON.stringify(updated));
  }

  // Remove a material permanently from the global list
  function removeMaterialGlobal(key) {
    if (!window.confirm('Permanently remove this material from all future entries?')) return;
    const updated = matList.filter(m => m.key !== key);
    setMatList(updated);
    localStorage.setItem('gppms_png_materials', JSON.stringify(updated));
  }

  // Dynamic custom columns state
  const [customCols, setCustomCols] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('gppms_custom_columns_house') || '[]');
    } catch { return []; }
  });

  // Hidden columns (default + custom) — persisted
  const [hiddenCols, setHiddenCols] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gppms_hidden_cols_house') || '[]'); } catch { return []; }
  });
  const [showColManager, setShowColManager] = useState(false);

  function toggleColVisibility(key) {
    const updated = hiddenCols.includes(key)
      ? hiddenCols.filter(k => k !== key)
      : [...hiddenCols, key];
    setHiddenCols(updated);
    localStorage.setItem('gppms_hidden_cols_house', JSON.stringify(updated));
  }

  const handleAddColumn = () => {
    const name = prompt('Enter new column name:');
    if (!name || !name.trim()) return;
    const newCol = {
      key: 'custom_' + Date.now(),
      label: name.trim()
    };
    const updated = [...customCols, newCol];
    setCustomCols(updated);
    localStorage.setItem('gppms_custom_columns_house', JSON.stringify(updated));
    showToast(`✓ Column "${name.trim()}" added`);
  };

  // Column manager replaces old number-prompt remove
  // handleRemoveColumn is now replaced by setShowColManager(true)

  // Dual photo state
  const [photo1,        setPhoto1]        = useState(null);
  const [photo1Preview, setPhoto1Preview] = useState(null);
  const [photo2,        setPhoto2]        = useState(null);
  const [photo2Preview, setPhoto2Preview] = useState(null);

  // Photo popover state (for table cell)
  const [photoPopover, setPhotoPopover] = useState(null); // houseId or null

  function reset() { setPage(1); }
  const f = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  /* Photo handler */
  const handlePhoto = (e, slot) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (slot === 1) { setPhoto1(file); setPhoto1Preview(url); }
    else            { setPhoto2(file); setPhoto2Preview(url); }
  };

  /* Convert file to base64 */
  const toBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
  });

  /* Photo utils */
  const viewPhoto = (data) => {
    const win = window.open();
    win.document.write(`<img src="${data}" style="max-width:100%;height:auto;background:#000" />`);
  };
  const downloadPhoto = (data, name) => {
    const a = document.createElement('a');
    a.href = data; a.download = name || 'photo.jpg';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

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
    // BP Number is now optional — only Name, Mobile, House No. required
    if (!form.name.trim())    e.name    = 'Required';
    if (!form.mobile.trim())  e.mobile  = 'Required';
    if (!form.houseNo.trim()) e.houseNo = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  /* ── Open Add panel ── */
  function openAddPanel() {
    setEditEntry(null);
    const initForm = { ...EMPTY_FORM };
    if (liveAreas && liveAreas.length > 0) {
      initForm.area = liveAreas[0];
    }
    customCols.forEach(c => { initForm[c.key] = ''; });
    setForm(initForm);
    setErrors({});
    setCustomMaterials([]);
    setHiddenMaterials([]);
    setPhoto1(null); setPhoto1Preview(null);
    setPhoto2(null); setPhoto2Preview(null);
    setPanelOpen(true);
  }

  /* ── Open Edit panel ── */
  function openEditPanel(h) {
    setEditEntry(h);
    const initForm = {
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
      side: h.side || 'LHS',
    };
    // Restore material quantities from saved entry
    matList.forEach(m => { initForm[m.key] = 0; }); // reset to 0

    customCols.forEach(c => { initForm[c.key] = h[c.key] || ''; });
    setForm(initForm);
    setErrors({});
    setCustomMaterials(h.customMaterials || []);
    setHiddenMaterials(h.hiddenMaterials || []);
    setPhoto1(null); setPhoto1Preview(null);
    setPhoto2(null); setPhoto2Preview(null);
    setShowDelete(false);
    setPanelOpen(true);
  }

  /* ── Save (add or update) — async for base64 photos ── */
  async function handleSave() {
    if (!validateForm()) return;

    // Validate photo sizes before converting
    if (photo1 && photo1.size > 4000000) { alert('Photo 1 is too large (>4MB). Please use a smaller image.'); return; }
    if (photo2 && photo2.size > 4000000) { alert('Photo 2 is too large (>4MB). Please use a smaller image.'); return; }

    // Convert to base64 for localStorage storage
    const p1b64 = photo1 ? await toBase64(photo1) : null;
    const p2b64 = photo2 ? await toBase64(photo2) : null;

    // Check base64 size after conversion (~2MB compressed limit)
    if (p1b64 && p1b64.length > 2000000) {
      alert('Photo 1 is too large. Please use a smaller image or take a photo at lower quality.'); return;
    }
    if (p2b64 && p2b64.length > 2000000) {
      alert('Photo 2 is too large. Please use a smaller image or take a photo at lower quality.'); return;
    }

    // Build materialsUsed dynamically from matList
    const materialsUsed = {};
    matList.forEach(mat => {
      const qty = form[mat.key] || 0;
      if (qty > 0) materialsUsed[mat.label] = { qty, unit: mat.unit };
    });

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
              photo1Data: p1b64 || h.photo1Data, photo1Name: photo1?.name || h.photo1Name,
              photo2Data: p2b64 || h.photo2Data, photo2Name: photo2?.name || h.photo2Name,
              photoCount: [p1b64 || h.photo1Data, p2b64 || h.photo2Data].filter(Boolean).length,
              ...Object.fromEntries(customCols.map(c => [c.key, form[c.key] || ''])),
              updatedAt: new Date().toISOString(),
            }
          : h
      );
      setAllHouses(updated);
      localStorage.setItem('gppms_houses', JSON.stringify(updated));
      setPanelOpen(false); setEditEntry(null);
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
        photo1Data: p1b64, photo1Name: photo1?.name || null,
        photo2Data: p2b64, photo2Name: photo2?.name || null,
        photoCount: [p1b64, p2b64].filter(Boolean).length,
        materialsUsed,
        customMaterials: customMaterials.filter(m => m.label.trim()),
        hiddenMaterials,
        ...Object.fromEntries(customCols.map(c => [c.key, form[c.key] || ''])),
        createdAt: new Date().toISOString(),
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

      setPanelOpen(false); setForm(EMPTY_FORM); setErrors({});
      setPhoto1(null); setPhoto1Preview(null); setPhoto2(null); setPhoto2Preview(null);
      setCustomMaterials([]);
      setHiddenMaterials([]);
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
            <Field label="BP Number (optional)"><Input value={form.bpNo} onChange={e => f('bpNo', e.target.value)} /></Field>
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
              <Field label="Area"><Select value={form.area} onChange={e => f('area', e.target.value)}>{(liveAreas.length > 0 ? liveAreas : AREAS_LIST).map(a => <option key={a}>{a}</option>)}</Select></Field>
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
          {/* Section 4: Meter Details */}
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

          {/* House Photos — Two slots */}
          <div style={{ marginTop: 12, marginBottom: 4 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 8, color: '#374151' }}>House Photos</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>

              {/* Photo 1 */}
              <div>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 500 }}>Photo 1 — Meter / Connection</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  <div onClick={() => document.getElementById('cam1').click()}
                    style={{ border: '1px dashed #2d6a27', borderRadius: 5, padding: '10px 6px', textAlign: 'center', cursor: 'pointer', color: '#2d6a27', fontSize: 10, fontWeight: 600 }}>📷 Camera</div>
                  <div onClick={() => document.getElementById('gal1').click()}
                    style={{ border: '1px dashed #2d6a27', borderRadius: 5, padding: '10px 6px', textAlign: 'center', cursor: 'pointer', color: '#2d6a27', fontSize: 10, fontWeight: 600 }}>🖼 Gallery</div>
                </div>
                <input id="cam1" type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => handlePhoto(e, 1)} />
                <input id="gal1" type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handlePhoto(e, 1)} />
                {photo1Preview && (
                  <div style={{ marginTop: 6 }}>
                    <img src={photo1Preview} style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 4, border: '1px solid #d1d5db' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 }}>
                      <span style={{ fontSize: 10, color: '#2d6a27' }}>✓ Photo 1 ready</span>
                      <button type="button" onClick={() => { setPhoto1(null); setPhoto1Preview(null); }} style={{ fontSize: 10, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Photo 2 */}
              <div>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 500 }}>Photo 2 — Additional / Site</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  <div onClick={() => document.getElementById('cam2').click()}
                    style={{ border: '1px dashed #2d6a27', borderRadius: 5, padding: '10px 6px', textAlign: 'center', cursor: 'pointer', color: '#2d6a27', fontSize: 10, fontWeight: 600 }}>📷 Camera</div>
                  <div onClick={() => document.getElementById('gal2').click()}
                    style={{ border: '1px dashed #2d6a27', borderRadius: 5, padding: '10px 6px', textAlign: 'center', cursor: 'pointer', color: '#2d6a27', fontSize: 10, fontWeight: 600 }}>🖼 Gallery</div>
                </div>
                <input id="cam2" type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => handlePhoto(e, 2)} />
                <input id="gal2" type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handlePhoto(e, 2)} />
                {photo2Preview && (
                  <div style={{ marginTop: 6 }}>
                    <img src={photo2Preview} style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 4, border: '1px solid #d1d5db' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 }}>
                      <span style={{ fontSize: 10, color: '#2d6a27' }}>✓ Photo 2 ready</span>
                      <button type="button" onClick={() => { setPhoto2(null); setPhoto2Preview(null); }} style={{ fontSize: 10, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        <div>
          <SectionTitle>5. Materials Used</SectionTitle>
          <p style={{ fontSize: 11, color: '#64748b', marginBottom: 10, background: '#fef3c7', padding: '6px 10px', borderRadius: 4 }}>
            ⚠ Quantities entered here will be deducted from site stock.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {matList.filter(mat => !hiddenMaterials.includes(mat.key)).map(mat => (
              <div key={mat.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ flex: 1, fontSize: 12, color: '#374151' }}>{mat.label}</label>
                <span style={{ fontSize: 11, color: '#94a3b8', width: 32 }}>{mat.unit}</span>
                <input type="number" min={0} value={form[mat.key] || 0} onChange={e => f(mat.key, Number(e.target.value))}
                  style={{ width: 72, height: 30, border: '1px solid #d1d5db', borderRadius: 4, padding: '0 8px', fontSize: 13 }} />
                {/* × hide for this entry only */}
                <button type="button"
                  onClick={() => setHiddenMaterials(prev => [...prev, mat.key])}
                  title="Hide for this entry only"
                  style={{ width: 26, height: 30, background: '#fef9c3', color: '#92400e', border: '1px solid #fde68a', borderRadius: 4, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 700 }}
                >−</button>
                {/* 🗑 permanently delete from global list */}
                <button type="button"
                  onClick={() => removeMaterialGlobal(mat.key)}
                  title="Permanently delete this material"
                  style={{ width: 26, height: 30, background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                >&#x1F5D1;</button>
              </div>
            ))}
            {/* Custom per-entry materials */}
            {customMaterials.map((mat, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  value={mat.label}
                  onChange={e => setCustomMaterials(prev => prev.map((m, i) => i === idx ? { ...m, label: e.target.value } : m))}
                  placeholder="Material name"
                  style={{ flex: 1, height: 30, border: '1px solid #d1d5db', borderRadius: 4, padding: '0 8px', fontSize: 12 }}
                />
                <input
                  value={mat.unit}
                  onChange={e => setCustomMaterials(prev => prev.map((m, i) => i === idx ? { ...m, unit: e.target.value } : m))}
                  placeholder="unit"
                  style={{ width: 48, height: 30, border: '1px solid #d1d5db', borderRadius: 4, padding: '0 6px', fontSize: 12 }}
                />
                <input
                  type="number" min={0}
                  value={mat.qty}
                  onChange={e => setCustomMaterials(prev => prev.map((m, i) => i === idx ? { ...m, qty: Number(e.target.value) } : m))}
                  style={{ width: 68, height: 30, border: '1px solid #d1d5db', borderRadius: 4, padding: '0 6px', fontSize: 13 }}
                />
                <button type="button" onClick={() => setCustomMaterials(prev => prev.filter((_, i) => i !== idx))}
                  style={{ width: 26, height: 30, background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                >×</button>
              </div>
            ))}
            {/* Add persistent material to global list */}
            <button
              type="button"
              onClick={addMaterialGlobal}
              style={{ marginTop: 4, height: 32, background: '#2d6a27', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              + Add Material to List
            </button>
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
            <>
              <button onClick={() => setShowColManager(true)}
                style={{ height: 32, background: '#2d6a27', color: '#fff', border: 'none', borderRadius: 4, padding: '0 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                ⚙ Manage Columns
              </button>
              <button onClick={openAddPanel}
                style={{ height: 32, background: '#1f4e1a', color: '#fff', border: 'none', borderRadius: 4, padding: '0 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                + Add New Entry
              </button>
            </>
          )}
        </div>
      </div>
      <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10, textAlign: 'right' }}>
        Default shows all historical data &nbsp;|&nbsp;
        <span style={{ color: '#16a34a', fontWeight: 600 }}>{exportPreview.done} Done</span>&nbsp;
        / <span style={{ color: '#dc2626', fontWeight: 600 }}>{exportPreview.pending} Pending</span>&nbsp;
        / {exportPreview.total} Total in selected range
      </p>
          {/* Filter bar — Account Type, Area, BP Number */}
          <div className="card section-block" style={{ padding: '10px 14px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <select className="gp-select-dark" style={{ width: 160 }} value={filterAcct} onChange={e => { setFilterAcct(e.target.value); reset(); }}>
                <option value="">-- Account Type --</option>
                {ACCT_TYPES.map(a => <option key={a}>{a}</option>)}
              </select>
              <select className="gp-select-dark" style={{ width: 160 }} value={filterArea} onChange={e => { setFilterArea(e.target.value); reset(); }}>
                <option value="">All Areas</option>
                {(liveAreas.length > 0 ? liveAreas : AREAS_LIST).map(a => <option key={a}>{a}</option>)}
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
                <th style={{ width: 40 }}>Sr.</th>
                {DEFAULT_COLS.filter(c => !hiddenCols.includes(c.key)).map(c => <th key={c.key}>{c.label}</th>)}
                {customCols.filter(c => !hiddenCols.includes(c.key)).map(col => <th key={col.key}>{col.label}</th>)}
                <th>Photo</th>
                <th>Action</th>
                {canWrite && <th>&#9998;</th>}
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr><td colSpan={17 + customCols.length} style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                  <div style={{ fontSize: 32 }}>📋</div>
                  <div style={{ marginTop: 8, fontSize: 14 }}>No entries found</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Try adjusting your filters or add a new entry</div>
                </td></tr>
              ) : paged.map((h, index) => (
                <tr key={h.id}>
                  <td style={{ textAlign: 'center', color: '#94a3b8' }}>{(page - 1) * PAGE_SIZE + index + 1}</td>
                  {!hiddenCols.includes('acct')       && <td style={{ fontSize: 11, color: '#64748b' }}>{h.acctType}</td>}
                  {!hiddenCols.includes('bpNo')       && <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{h.bpNo || '—'}</td>}
                  {!hiddenCols.includes('name')       && <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{h.name}</td>}
                  {!hiddenCols.includes('mobile')     && <td style={{ whiteSpace: 'nowrap' }}>{h.mobile}</td>}
                  {!hiddenCols.includes('houseNo')    && <td style={{ whiteSpace: 'nowrap' }}>{h.houseNo}</td>}
                  {!hiddenCols.includes('area')       && <td>{h.area}</td>}
                  {!hiddenCols.includes('city')       && <td>{h.city}</td>}
                  {!hiddenCols.includes('meterNo')    && <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{h.meterNo || '—'}</td>}
                  {!hiddenCols.includes('meterDate')  && <td style={{ whiteSpace: 'nowrap' }}>{formatDate(h.meterDate)}</td>}
                  {!hiddenCols.includes('gcStatus')   && <td><StatusBadge val={h.gcStatus} /></td>}
                  {!hiddenCols.includes('giStatus')   && <td><StatusBadge val={h.giStatus} /></td>}
                  {!hiddenCols.includes('rfc')        && <td><StatusBadge val={h.rfc} /></td>}
                  {!hiddenCols.includes('ngStatus')   && <td><StatusBadge val={h.ngStatus} /></td>}
                  {!hiddenCols.includes('saralStatus')&& <td><StatusBadge val={h.saralStatus} /></td>}
                  {customCols.filter(c => !hiddenCols.includes(c.key)).map(col => <td key={col.key} style={{ whiteSpace: 'nowrap' }}>{h[col.key] || '—'}</td>)}
                  <td style={{ textAlign: 'center', position: 'relative' }}>
                    {/* Photo badge — clickable popover */}
                    {(() => {
                      const cnt = h.photoCount ?? (h.meterPhoto ? 1 : 0);
                      const label = cnt === 2 ? '2 Photos' : cnt === 1 ? '1 Photo' : 'None';
                      const color = cnt > 0 ? '#16a34a' : '#94a3b8';
                      const bg    = cnt > 0 ? '#dcfce7' : '#f1f5f9';
                      return (
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <span
                            onClick={cnt > 0 ? e => { e.stopPropagation(); setPhotoPopover(photoPopover === h.id ? null : h.id); } : undefined}
                            style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: bg, color, cursor: cnt > 0 ? 'pointer' : 'default', userSelect: 'none' }}
                          >
                            {label}
                          </span>
                          {photoPopover === h.id && cnt > 0 && (
                            <div
                              onClick={e => e.stopPropagation()}
                              style={{ position: 'absolute', zIndex: 200, top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 4, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', padding: '10px 12px', minWidth: 200, textAlign: 'left' }}
                            >
                              {[{ data: h.photo1Data, name: h.photo1Name, label: 'Photo 1 — Meter' }, { data: h.photo2Data, name: h.photo2Name, label: 'Photo 2 — Site' }]
                                .filter(p => p.data)
                                .map((p, i) => (
                                  <div key={i} style={{ marginBottom: i === 0 && h.photo2Data ? 10 : 0 }}>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 5 }}>📷 {p.label}</div>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                      <button onClick={() => viewPhoto(p.data)}
                                        style={{ flex: 1, fontSize: 11, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4, background: '#f8fafc', cursor: 'pointer', color: '#374151' }}>👁 View</button>
                                      <button onClick={() => downloadPhoto(p.data, p.name)}
                                        style={{ flex: 1, fontSize: 11, padding: '4px 8px', border: '1px solid #2d6a27', borderRadius: 4, background: '#f0fdf4', cursor: 'pointer', color: '#15803d' }}>⬇ Download</button>
                                    </div>
                                  </div>
                                ))
                              }
                              <button onClick={() => setPhotoPopover(null)}
                                style={{ marginTop: 8, width: '100%', fontSize: 10, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}>Close</button>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </td>
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
        {FormBody()}

        {customCols.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <SectionTitle>6. Additional Information</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {customCols.map(col => (
                <Field key={col.key} label={col.label}>
                  <Input value={form[col.key] || ''} onChange={e => f(col.key, e.target.value)} />
                </Field>
              ))}
            </div>
          </div>
        )}
      </SlidePanel>

      {showDelete && (
        <ConfirmDelete
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
        />
      )}

      {/* ── Column Manager Modal ── */}
      {showColManager && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:9000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={() => setShowColManager(false)}>
          <div style={{ background:'#fff', borderRadius:12, padding:28, maxWidth:420, width:'100%', boxShadow:'0 20px 60px rgba(0,0,0,0.25)', maxHeight:'85vh', overflowY:'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
              <h3 style={{ margin:0, fontSize:16, fontWeight:700, color:'#1f4e1a' }}>⚙ Manage Columns</h3>
              <button onClick={() => setShowColManager(false)}
                style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#64748b', lineHeight:1 }}>×</button>
            </div>
            <p style={{ fontSize:12, color:'#64748b', marginBottom:14 }}>Toggle columns on/off. Hidden columns are saved for your session.</p>

            <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>Built-in Columns</div>
            <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:16 }}>
              {DEFAULT_COLS.map(col => (
                <label key={col.key} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:6, background: hiddenCols.includes(col.key) ? '#f8fafc' : '#f0f7ee', cursor:'pointer', border:'1px solid', borderColor: hiddenCols.includes(col.key) ? '#e2e8f0' : '#bbf7d0' }}>
                  <input type="checkbox" checked={!hiddenCols.includes(col.key)}
                    onChange={() => toggleColVisibility(col.key)}
                    style={{ accentColor:'#2d6a27', width:15, height:15 }} />
                  <span style={{ fontSize:13, fontWeight:500, color: hiddenCols.includes(col.key) ? '#94a3b8' : '#1f4e1a', flex:1 }}>{col.label}</span>
                  {hiddenCols.includes(col.key) && <span style={{ fontSize:10, color:'#94a3b8', background:'#f1f5f9', padding:'1px 6px', borderRadius:4 }}>hidden</span>}
                </label>
              ))}
            </div>

            {customCols.length > 0 && (
              <>
                <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>Custom Columns</div>
                <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:16 }}>
                  {customCols.map(col => (
                    <div key={col.key} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:6, background: hiddenCols.includes(col.key) ? '#f8fafc' : '#fefce8', border:'1px solid', borderColor: hiddenCols.includes(col.key) ? '#e2e8f0' : '#fde68a' }}>
                      <input type="checkbox" checked={!hiddenCols.includes(col.key)}
                        onChange={() => toggleColVisibility(col.key)}
                        style={{ accentColor:'#2d6a27', width:15, height:15 }} />
                      <span style={{ fontSize:13, fontWeight:500, color: hiddenCols.includes(col.key) ? '#94a3b8' : '#92400e', flex:1 }}>{col.label}</span>
                      <button onClick={() => {
                        const updated = customCols.filter(c => c.key !== col.key);
                        setCustomCols(updated);
                        localStorage.setItem('gppms_custom_columns_house', JSON.stringify(updated));
                        setHiddenCols(prev => prev.filter(k => k !== col.key));
                        showToast(`Column "${col.label}" deleted`);
                      }} title="Delete this column permanently"
                        style={{ background:'#fee2e2', color:'#dc2626', border:'none', borderRadius:4, width:26, height:26, cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>×</button>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div style={{ borderTop:'1px solid #f1f5f9', paddingTop:14 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>Add New Column</div>
              <div style={{ display:'flex', gap:8 }}>
                <input id="newColInput" placeholder="Column name..."
                  style={{ flex:1, height:34, border:'1px solid #d1d5db', borderRadius:6, padding:'0 10px', fontSize:13 }} />
                <button onClick={() => {
                  const val = document.getElementById('newColInput')?.value?.trim();
                  if (!val) return;
                  const newCol = { key: 'custom_' + Date.now(), label: val };
                  const updated = [...customCols, newCol];
                  setCustomCols(updated);
                  localStorage.setItem('gppms_custom_columns_house', JSON.stringify(updated));
                  document.getElementById('newColInput').value = '';
                  showToast(`✓ Column "${val}" added`);
                }} style={{ height:34, background:'#2d6a27', color:'#fff', border:'none', borderRadius:6, padding:'0 14px', fontSize:13, fontWeight:600, cursor:'pointer' }}>+ Add</button>
              </div>
            </div>

            <button onClick={() => { setHiddenCols([]); localStorage.removeItem('gppms_hidden_cols_house'); showToast('All columns visible'); }}
              style={{ marginTop:14, width:'100%', height:32, background:'#f1f5f9', color:'#374151', border:'1px solid #e2e8f0', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer' }}>
              ↺ Reset — Show All Columns
            </button>
          </div>
        </div>
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
