// src/pages/PELaying.jsx
import { useState, useMemo, useEffect } from 'react';
import defaultPeLaying from '../data/peLaying';
import { exportPELaying } from '../utils/exportExcel';
import SlidePanel, { Field, Input, Select, SectionTitle } from '../components/SlidePanel';
import { useToast } from '../components/Toast';
import { useSite } from '../context/SiteContext';

function initStore(key, defaults) {
  try {
    const raw = localStorage.getItem('gppms_' + key);
    if (!raw) { localStorage.setItem('gppms_' + key, JSON.stringify(defaults)); return defaults; }
    return JSON.parse(raw);
  } catch { return defaults; }
}

const todayStr = () => new Date().toISOString().split('T')[0];

// Work Status
const WK_STATUSES = ['Laying', 'Testing & Flushing', 'Commissioning'];
const CONN_TYPES  = ['Domestic', 'Commercial', 'Industrial'];

const DEFAULT_COLS = [
  { key: 'layDate',    label: 'Laying Date' },
  { key: 'area',       label: 'Area' },
  { key: 'coil',       label: 'Coil/Batch No.' },
  { key: 'd32oc',      label: 'Ø32 Laying' },
  { key: 'd32b',       label: 'Ø32 Boring' },
  { key: 'd32hdd',     label: 'Ø32 HDD' },
  { key: 'd63oc',      label: 'Ø63 Laying' },
  { key: 'd63b',       label: 'Ø63 Boring' },
  { key: 'd63hdd',     label: 'Ø63 HDD' },
  { key: 'd90oc',      label: 'Ø90 Laying' },
  { key: 'd90b',       label: 'Ø90 Boring' },
  { key: 'd90hdd',     label: 'Ø90 HDD' },
  { key: 'd125oc',     label: 'Ø125 Laying' },
  { key: 'd125b',      label: 'Ø125 Boring' },
  { key: 'd125hdd',    label: 'Ø125 HDD' },
  { key: 'workStatus', label: 'Work Status' },
];

const EMPTY_ENTRY = {
  layDate: '', connType: 'Domestic', area: '', coil: '',
  d32oc: '', d32b: '', d32hdd: '',
  d63oc: '', d63b: '', d63hdd: '',
  d90oc: '', d90b: '', d90hdd: '',
  d125oc: '', d125b: '', d125hdd: '',
  workStatus: 'Laying',
};

export default function PELaying() {
  const { showToast } = useToast();
  const { siteList, selGA, mergedGAs, getCitiesForGA, getAreasForCity, globalLocationContext }  = useSite();
  const [allData, setAllData] = useState([]);

  // 3-level form states for GA Location, City, Area
  const [formGA,   setFormGA]   = useState('');
  const [formCity, setFormCity] = useState('');
  const [formArea, setFormArea] = useState('');

  // Option lists
  const getAllCities = () => {
    return mergedGAs.flatMap(ga => ga.cities || []);
  };
  const cityOptions = formGA !== '' ? getCitiesForGA(formGA) : getAllCities();
  const areaOptions = formCity !== '' ? getAreasForCity(formCity) : [];

  // Pre-fill and restrict GA / City / Area fields when panel opens or editingId changes
  useEffect(() => {
    if (panelOpen) {
      if (editingId) {
        const row = allData.find(r => r.id === editingId || r.sr === editingId);
        if (row) {
          // Resolve GA & City from row.area
          let foundGAId = '';
          let foundCityId = '';
          for (const ga of mergedGAs) {
            const city = (ga.cities || []).find(c => (c.areas || []).includes(row.area));
            if (city) {
              foundGAId = ga.id;
              foundCityId = city.id;
              break;
            }
          }
          setFormGA(foundGAId || '');
          setFormCity(foundCityId || '');
          setFormArea(row.area || '');
        }
      } else {
        const ctx = globalLocationContext || { gaId: 'all', cityId: 'all', area: 'all' };
        setFormGA(ctx.gaId !== 'all' ? ctx.gaId : '');
        setFormCity(ctx.cityId !== 'all' ? ctx.cityId : '');
        setFormArea(ctx.area !== 'all' ? ctx.area : '');
      }
    }
  }, [panelOpen, editingId, globalLocationContext, mergedGAs, allData]);

  useEffect(() => {
    document.title = 'GP-PMS — PE Laying';
    setAllData(initStore('pelaying', defaultPeLaying));
  }, []);

  // Filter / tab state
  const [activeTab, setActiveTab] = useState('Domestic');
  const [filterArea, setFilterArea] = useState('');

  // Export date state
  const [exportFromDate, setExportFromDate] = useState(todayStr());
  const [exportToDate,   setExportToDate]   = useState(todayStr());
  const dateError = exportFromDate && exportToDate && exportFromDate > exportToDate;

  // Panel state — also used for edit
  const [panelOpen, setPanelOpen]   = useState(false);
  const [editingId, setEditingId]   = useState(null);
  const [showDelete, setShowDelete] = useState(false);
  const [form,      setForm]        = useState(EMPTY_ENTRY);
  const [errors,    setErrors]      = useState({});

  const f = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  // Custom and hidden columns state
  const [customCols, setCustomCols] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gppms_custom_columns_pelaying') || '[]'); } catch { return []; }
  });
  const [hiddenCols, setHiddenCols] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gppms_hidden_cols_pelaying') || '[]'); } catch { return []; }
  });
  const [showColManager, setShowColManager] = useState(false);

  function toggleColVisibility(key) {
    const updated = hiddenCols.includes(key)
      ? hiddenCols.filter(k => k !== key)
      : [...hiddenCols, key];
    setHiddenCols(updated);
    localStorage.setItem('gppms_hidden_cols_pelaying', JSON.stringify(updated));
  }

  // ── KPI totals (all data) ──
  const kpiTotals = useMemo(() => allData.reduce((acc, r) => ({
    d32:  acc.d32  + (Number(r.d32oc)  || 0) + (Number(r.d32b)  || 0) + (Number(r.d32hdd)  || 0),
    d63:  acc.d63  + (Number(r.d63oc)  || 0) + (Number(r.d63b)  || 0) + (Number(r.d63hdd)  || 0),
    d90:  acc.d90  + (Number(r.d90oc)  || 0) + (Number(r.d90b)  || 0) + (Number(r.d90hdd)  || 0) + (Number(r.d90tot)  || 0),
    d125: acc.d125 + (Number(r.d125oc) || 0) + (Number(r.d125b) || 0) + (Number(r.d125hdd) || 0) + (Number(r.d125tot) || 0),
  }), { d32: 0, d63: 0, d90: 0, d125: 0 }), [allData]);

  // ── Filtered rows (by tab + area + global GA) ──
  const filtered = useMemo(() => allData.filter(r => {
    const tab = r.connType || 'Domestic';
    if (tab !== activeTab) return false;
    
    // Global GA location filter
    if (selGA && selGA !== 'all') {
      const ga = mergedGAs.find(g => g.id === selGA);
      if (ga) {
        const allGaAreas = (ga.cities || []).flatMap(c => c.areas || []);
        if (allGaAreas.length > 0 && !allGaAreas.includes(r.area)) return false;
      }
    }

    if (filterArea && !(r.area || '').toLowerCase().includes(filterArea.toLowerCase())) return false;
    return true;
  }), [allData, activeTab, filterArea, selGA, mergedGAs]);

  // ── Column totals ──
  const totals = useMemo(() => filtered.reduce((acc, r) => ({
    d32oc:   acc.d32oc   + (Number(r.d32oc)   || 0),
    d32b:    acc.d32b    + (Number(r.d32b)    || 0),
    d32hdd:  acc.d32hdd  + (Number(r.d32hdd)  || 0),
    d63oc:   acc.d63oc   + (Number(r.d63oc)   || 0),
    d63b:    acc.d63b    + (Number(r.d63b)    || 0),
    d63hdd:  acc.d63hdd  + (Number(r.d63hdd)  || 0),
    d90oc:   acc.d90oc   + (Number(r.d90oc)   || 0),
    d90b:    acc.d90b    + (Number(r.d90b)    || 0),
    d90hdd:  acc.d90hdd  + (Number(r.d90hdd)  || 0),
    d90t:    acc.d90t    + (Number(r.d90oc)   || 0) + (Number(r.d90b)   || 0) + (Number(r.d90hdd) || 0) + (Number(r.d90tot) || 0),
    d125oc:  acc.d125oc  + (Number(r.d125oc)  || 0),
    d125b:   acc.d125b   + (Number(r.d125b)   || 0),
    d125hdd: acc.d125hdd + (Number(r.d125hdd) || 0),
    d125t:   acc.d125t   + (Number(r.d125oc)  || 0) + (Number(r.d125b)  || 0) + (Number(r.d125hdd) || 0) + (Number(r.d125tot) || 0),
  }), { d32oc:0,d32b:0,d32hdd:0,d63oc:0,d63b:0,d63hdd:0,d90oc:0,d90b:0,d90hdd:0,d90t:0,d125oc:0,d125b:0,d125hdd:0,d125t:0 }), [filtered]);

  function handleExport() { exportPELaying(filtered, exportFromDate, exportToDate); }

  function validateForm() {
    const e = {};
    if (!form.layDate)        e.layDate   = 'Laying Date is required';
    if (!form.connType)       e.connType  = 'Connection Type is required';
    if (!formGA)   e.ga   = 'Required';
    if (!formCity) e.city = 'Required';
    if (!formArea) e.area = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function openAddPanel() {
    setEditingId(null);
    const initForm = { ...EMPTY_ENTRY };
    customCols.forEach(c => { initForm[c.key] = ''; });
    setForm(initForm);
    setErrors({});
    setPanelOpen(true);
  }

  function openEditPanel(row) {
    setEditingId(row.id || row.sr);
    const initForm = {
      layDate:    row.layDate    || '',
      connType:   row.connType   || 'Domestic',
      area:       row.area       || '',
      coil:       row.coil       || '',
      d32oc:      row.d32oc  != null && row.d32oc  !== 0 ? row.d32oc  : '',
      d32b:       row.d32b   != null && row.d32b   !== 0 ? row.d32b   : '',
      d32hdd:     row.d32hdd != null && row.d32hdd !== 0 ? row.d32hdd : '',
      d63oc:      row.d63oc  != null && row.d63oc  !== 0 ? row.d63oc  : '',
      d63b:       row.d63b   != null && row.d63b   !== 0 ? row.d63b   : '',
      d63hdd:     row.d63hdd != null && row.d63hdd !== 0 ? row.d63hdd : '',
      d90oc:      row.d90oc  != null && row.d90oc  !== 0 ? row.d90oc  : '',
      d90b:       row.d90b   != null && row.d90b   !== 0 ? row.d90b   : '',
      d90hdd:     row.d90hdd != null && row.d90hdd !== 0 ? row.d90hdd : '',
      d125oc:     row.d125oc != null && row.d125oc !== 0 ? row.d125oc : '',
      d125b:      row.d125b  != null && row.d125b  !== 0 ? row.d125b  : '',
      d125hdd:    row.d125hdd != null && row.d125hdd !== 0 ? row.d125hdd : '',
      workStatus: row.workStatus || 'Laying',
    };
    customCols.forEach(c => { initForm[c.key] = row[c.key] || ''; });
    setForm(initForm);
    setErrors({});
    setPanelOpen(true);
  }

  function handleSave() {
    if (!validateForm()) return;
    const entryBase = {
      ...form,
      area:    formArea,
      d32oc:   Number(form.d32oc)   || 0,
      d32b:    Number(form.d32b)    || 0,
      d32hdd:  Number(form.d32hdd)  || 0,
      d63oc:   Number(form.d63oc)   || 0,
      d63b:    Number(form.d63b)    || 0,
      d63hdd:  Number(form.d63hdd)  || 0,
      d90oc:   Number(form.d90oc)   || 0,
      d90b:    Number(form.d90b)    || 0,
      d90hdd:  Number(form.d90hdd)  || 0,
      d125oc:  Number(form.d125oc)  || 0,
      d125b:   Number(form.d125b)   || 0,
      d125hdd: Number(form.d125hdd) || 0,
      ...Object.fromEntries(customCols.map(c => [c.key, form[c.key] || ''])),
    };
    let updated;
    if (editingId !== null) {
      updated = allData.map(r =>
        (r.id === editingId || r.sr === editingId) ? { ...r, ...entryBase } : r
      );
      showToast('✓ PE Laying entry updated');
    } else {
      const newEntry = { ...entryBase, id: Date.now(), sr: (allData.length + 1) };
      updated = [newEntry, ...allData];
      showToast('✓ PE Laying entry added');
    }
    setAllData(updated);
    localStorage.setItem('gppms_pelaying', JSON.stringify(updated));
    setPanelOpen(false);
    setForm(EMPTY_ENTRY);
    setErrors({});
    setEditingId(null);
  }

  function handleDelete() {
    const updated = allData.filter(r => (r.id !== editingId && r.sr !== editingId));
    setAllData(updated);
    localStorage.setItem('gppms_pelaying', JSON.stringify(updated));
    setPanelOpen(false);
    setShowDelete(false);
    setEditingId(null);
    showToast('Entry deleted');
  }

  const d32Total  = (Number(form.d32oc)  || 0) + (Number(form.d32b)  || 0) + (Number(form.d32hdd)  || 0);
  const d63Total  = (Number(form.d63oc)  || 0) + (Number(form.d63b)  || 0) + (Number(form.d63hdd)  || 0);
  const d90Total  = (Number(form.d90oc)  || 0) + (Number(form.d90b)  || 0) + (Number(form.d90hdd)  || 0);
  const d125Total = (Number(form.d125oc) || 0) + (Number(form.d125b) || 0) + (Number(form.d125hdd) || 0);

  const num = v => {
    const n = Number(v);
    return n > 0 ? n : <span style={{ color: '#cbd5e1' }}>—</span>;
  };

  return (
    <div>
      {/* Title + Action buttons */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1f4e1a', margin: 0 }}>PE Laying — Pipeline Progress</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setShowColManager(true)}
            style={{ height: 34, background: '#2d6a27', color: '#fff', border: 'none', borderRadius: 5, padding: '0 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            ⚙ Manage Columns
          </button>
          <button onClick={openAddPanel}
            style={{ height: 34, background: '#1f4e1a', color: '#fff', border: 'none', borderRadius: 5, padding: '0 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            + Add Laying Entry
          </button>
        </div>
      </div>

      {/* KPI Summary Row — recalculated from data */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
        {[
          { label: 'Total Ø32mm', val: kpiTotals.d32  },
          { label: 'Total Ø63mm', val: kpiTotals.d63  },
          { label: 'Total Ø90mm', val: kpiTotals.d90  },
          { label: 'Total Ø125mm',val: kpiTotals.d125 },
        ].map(k => (
          <div key={k.label} className="kpi-tile" style={{ background: '#2d6a27' }}>
            <p className="kpi-label">{k.label}</p>
            <p className="kpi-value" style={{ fontSize: 22 }}>{k.val.toLocaleString()} mtr</p>
          </div>
        ))}
      </div>

      {/* Connection Type Tabs */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, 
        alignItems: 'center', flexWrap: 'wrap' }}>
        {CONN_TYPES.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ 
              padding: '8px 20px', 
              borderRadius: 6, 
              fontSize: 13, 
              fontWeight: 600,
              height: '38px',
              border: activeTab === tab ? 'none' : '1px solid #d1d5db',
              background: activeTab === tab ? '#2d6a27' : '#fff',
              color: activeTab === tab ? '#fff' : '#64748b',
              cursor: 'pointer', 
              transition: 'all 0.15s',
              display: 'flex', alignItems: 'center'
            }}>
            {tab}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="card section-block" style={{ 
        padding: '12px 14px', 
        display: 'flex', 
        flexWrap: 'wrap', 
        gap: 10, 
        alignItems: 'center', 
        marginBottom: 12 }}>
        <input className="gp-input" 
          placeholder="Filter by Area..."
          style={{ 
            width: 220, 
            height: '38px', 
            fontSize: 13, 
            padding: '0 14px',
            border: '1px solid #d1d5db',
            borderRadius: '6px'
          }} 
          value={filterArea}
          onChange={e => setFilterArea(e.target.value)} />
        <button onClick={() => setFilterArea('')}
          style={{
            padding: '0 20px', 
            height: '38px', 
            fontSize: 13, 
            fontWeight: 600,
            background: 'white', 
            border: '1px solid #2d6a27',
            color: '#2d6a27', 
            borderRadius: '6px',
            cursor: 'pointer'
          }}>
          Clear
        </button>

        {/* Export */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>Export from</span>
          <input type="date" value={exportFromDate} onChange={e => setExportFromDate(e.target.value)}
            style={{ height: 32, border: '1px solid #d1d5db', borderRadius: 4, padding: '0 8px', fontSize: 12 }} />
          <span style={{ fontSize: 12, color: '#64748b' }}>to</span>
          <input type="date" value={exportToDate} onChange={e => setExportToDate(e.target.value)}
            style={{ height: 32, border: '1px solid #d1d5db', borderRadius: 4, padding: '0 8px', fontSize: 12 }} />
          <button onClick={handleExport} disabled={!!dateError}
            style={{ height: 32, background: dateError ? '#94a3b8' : '#2d6a27', color: '#fff', border: 'none', borderRadius: 4, padding: '0 14px', fontSize: 12, fontWeight: 600, cursor: dateError ? 'not-allowed' : 'pointer' }}>
            ↓ Export Excel
          </button>
        </div>
      </div>
      {dateError && <p style={{ fontSize: 11, color: '#ef4444', margin: '4px 0 8px' }}>From date cannot be after To date</p>}

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="gp-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>Sr.</th>
                {!hiddenCols.includes('layDate') && <th>Laying Date</th>}
                {!hiddenCols.includes('area') && <th>Area</th>}
                {!hiddenCols.includes('coil') && <th>Coil/Batch No.</th>}
                {!hiddenCols.includes('d32oc') && <th style={{ textAlign: 'right' }}>Ø32 Laying</th>}
                {!hiddenCols.includes('d32b') && <th style={{ textAlign: 'right' }}>Ø32 Boring</th>}
                {!hiddenCols.includes('d32hdd') && <th style={{ textAlign: 'right' }}>Ø32 HDD</th>}
                {!hiddenCols.includes('d63oc') && <th style={{ textAlign: 'right' }}>Ø63 Laying</th>}
                {!hiddenCols.includes('d63b') && <th style={{ textAlign: 'right' }}>Ø63 Boring</th>}
                {!hiddenCols.includes('d63hdd') && <th style={{ textAlign: 'right' }}>Ø63 HDD</th>}
                {!hiddenCols.includes('d90oc') && <th style={{ textAlign: 'right' }}>Ø90 Laying</th>}
                {!hiddenCols.includes('d90b') && <th style={{ textAlign: 'right' }}>Ø90 Boring</th>}
                {!hiddenCols.includes('d90hdd') && <th style={{ textAlign: 'right' }}>Ø90 HDD</th>}
                {!hiddenCols.includes('d125oc') && <th style={{ textAlign: 'right' }}>Ø125 Laying</th>}
                {!hiddenCols.includes('d125b') && <th style={{ textAlign: 'right' }}>Ø125 Boring</th>}
                {!hiddenCols.includes('d125hdd') && <th style={{ textAlign: 'right' }}>Ø125 HDD</th>}
                {!hiddenCols.includes('workStatus') && <th>Work Status</th>}
                {customCols.filter(c => !hiddenCols.includes(c.key)).map(col => <th key={col.key}>{col.label}</th>)}
                <th style={{ width: 40 }}>✏</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={18 + customCols.length} style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                  <div style={{ fontSize: 32 }}>🚧</div>
                  <div style={{ marginTop: 8 }}>No {activeTab} entries found</div>
                </td></tr>
              ) : filtered.map((r, idx) => {
                const wsColor = r.workStatus === 'Commissioning' ? '#16a34a' : r.workStatus === 'Testing & Flushing' ? '#1d4ed8' : '#94a3b8';
                return (
                  <tr key={r.id || r.sr}>
                    <td style={{ textAlign: 'center', color: '#94a3b8' }}>{idx + 1}</td>
                    {!hiddenCols.includes('layDate') && <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.layDate}</td>}
                    {!hiddenCols.includes('area') && <td style={{ whiteSpace: 'nowrap' }}>{r.area}</td>}
                    {!hiddenCols.includes('coil') && <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.coil || '—'}</td>}
                    {!hiddenCols.includes('d32oc') && <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{num(r.d32oc)}</td>}
                    {!hiddenCols.includes('d32b') && <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{num(r.d32b)}</td>}
                    {!hiddenCols.includes('d32hdd') && <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{num(r.d32hdd)}</td>}
                    {!hiddenCols.includes('d63oc') && <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{num(r.d63oc)}</td>}
                    {!hiddenCols.includes('d63b') && <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{num(r.d63b)}</td>}
                    {!hiddenCols.includes('d63hdd') && <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{num(r.d63hdd)}</td>}
                    {!hiddenCols.includes('d90oc') && <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{num(r.d90oc)}</td>}
                    {!hiddenCols.includes('d90b') && <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{num(r.d90b)}</td>}
                    {!hiddenCols.includes('d90hdd') && <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{num(r.d90hdd)}</td>}
                    {!hiddenCols.includes('d125oc') && <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{num(r.d125oc)}</td>}
                    {!hiddenCols.includes('d125b') && <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{num(r.d125b)}</td>}
                    {!hiddenCols.includes('d125hdd') && <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{num(r.d125hdd)}</td>}
                    {!hiddenCols.includes('workStatus') && (
                      <td>
                        {r.workStatus && r.workStatus !== 'Laying' ? (
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: r.workStatus === 'Commissioning' ? '#dcfce7' : '#dbeafe', color: wsColor }}>{r.workStatus}</span>
                        ) : r.workStatus === 'Laying' ? (
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: '#f0f7ee', color: '#2d6a27' }}>Laying</span>
                        ) : <span style={{ color: '#cbd5e1' }}>—</span>}
                      </td>
                    )}
                    {customCols.filter(c => !hiddenCols.includes(c.key)).map(col => <td key={col.key} style={{ whiteSpace: 'nowrap' }}>{r[col.key] || '—'}</td>)}
                    <td style={{ textAlign: 'center' }}>
                      <button onClick={() => openEditPanel(r)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: '#2d6a27', padding: 2 }} title="Edit entry">✏</button>
                    </td>
                  </tr>
                );
              })}

              {/* Totals row */}
              {filtered.length > 0 && (
                <tr style={{ background: '#f0f7ee' }}>
                  <td colSpan={1 + (!hiddenCols.includes('layDate')?1:0) + (!hiddenCols.includes('area')?1:0) + (!hiddenCols.includes('coil')?1:0)} style={{ fontWeight: 700, color: '#1f4e1a', textAlign: 'right', fontSize: 12 }}>TOTAL</td>
                  {!hiddenCols.includes('d32oc') && <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{totals.d32oc}</td>}
                  {!hiddenCols.includes('d32b') && <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{totals.d32b}</td>}
                  {!hiddenCols.includes('d32hdd') && <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{totals.d32hdd}</td>}
                  {!hiddenCols.includes('d63oc') && <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{totals.d63oc}</td>}
                  {!hiddenCols.includes('d63b') && <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{totals.d63b}</td>}
                  {!hiddenCols.includes('d63hdd') && <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{totals.d63hdd}</td>}
                  {!hiddenCols.includes('d90oc') && <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{totals.d90oc}</td>}
                  {!hiddenCols.includes('d90b') && <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{totals.d90b}</td>}
                  {!hiddenCols.includes('d90hdd') && <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{totals.d90hdd}</td>}
                  {!hiddenCols.includes('d125oc') && <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{totals.d125oc}</td>}
                  {!hiddenCols.includes('d125b') && <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{totals.d125b}</td>}
                  {!hiddenCols.includes('d125hdd') && <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{totals.d125hdd}</td>}
                  {!hiddenCols.includes('workStatus') && <td />}
                  {customCols.filter(col => !hiddenCols.includes(col.key)).map(col => <td key={col.key} />)}
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Add / Edit Laying Entry Panel ── */}
      <SlidePanel
        isOpen={panelOpen}
        onClose={() => { setPanelOpen(false); setErrors({}); setEditingId(null); }}
        title={editingId !== null ? 'Edit PE Laying Entry' : 'Add PE Laying Entry'}
        onSave={handleSave}
        saveLabel={editingId !== null ? 'Update Entry' : 'Save Entry'}
      >
        <div>
          <SectionTitle>Entry Details</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Laying Date" required error={errors.layDate}>
                <Input type="date" value={form.layDate} onChange={e => f('layDate', e.target.value)} error={errors.layDate} />
              </Field>
              <Field label="Laying Type" required error={errors.connType}>
                <Select value={form.connType} onChange={e => f('connType', e.target.value)} error={errors.connType}>
                  {CONN_TYPES.map(t => <option key={t}>{t}</option>)}
                </Select>
              </Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Coil / Batch No.">
                <Input value={form.coil} onChange={e => f('coil', e.target.value)} />
              </Field>
              <Field label="Work Status">
                <Select value={form.workStatus} onChange={e => f('workStatus', e.target.value)}>
                  {WK_STATUSES.map(s => <option key={s}>{s}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="GA Location" required error={errors.ga}>
              <Select
                value={formGA}
                disabled={globalLocationContext?.gaId !== 'all'}
                onChange={e => {
                  setFormGA(e.target.value);
                  setFormCity('');
                  setFormArea('');
                }}
                error={errors.ga}
              >
                <option value="">Select GA Location</option>
                {mergedGAs.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
              </Select>
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="City" required error={errors.city}>
                <Select
                  value={formCity}
                  disabled={globalLocationContext?.cityId !== 'all'}
                  onChange={e => {
                    setFormCity(e.target.value);
                    setFormArea('');
                  }}
                  error={errors.city}
                >
                  <option value="">Select City</option>
                  {cityOptions.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </Select>
              </Field>
              <Field label="Area / Society" required error={errors.area}>
                <Select
                  value={formArea}
                  onChange={e => setFormArea(e.target.value)}
                  error={errors.area}
                >
                  <option value="">Select Area</option>
                  {areaOptions.map(a => <option key={a} value={a}>{a}</option>)}
                </Select>
              </Field>
            </div>
          </div>
        </div>

        <div>
          <SectionTitle>Pipe Quantities (metres)</SectionTitle>
          
          <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 1fr 1fr 1fr', gap: '8px 10px', alignItems: 'center', marginTop: 10 }}>
            {/* Row 1: Headers */}
            <div />
            <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textAlign: 'center' }}>Laying</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textAlign: 'center' }}>Boring</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textAlign: 'center' }}>HDD</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textAlign: 'center' }}>Total</div>

            {/* Row 2: Ø32 */}
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#1f4e1a' }}>Ø32mm</div>
            <Input type="number" min={0} value={form.d32oc === 0 || form.d32oc === '' ? '' : form.d32oc}
              onChange={e => { const val = e.target.value; f('d32oc', val === '' ? 0 : Number(val)); }}
              onBlur={e => { if (e.target.value === '') f('d32oc', 0); }}
              placeholder="0"
              style={{ textAlign: 'center', height: 28 }} />
            <Input type="number" min={0} value={form.d32b === 0 || form.d32b === '' ? '' : form.d32b}
              onChange={e => { const val = e.target.value; f('d32b', val === '' ? 0 : Number(val)); }}
              onBlur={e => { if (e.target.value === '') f('d32b', 0); }}
              placeholder="0"
              style={{ textAlign: 'center', height: 28 }} />
            <Input type="number" min={0} value={form.d32hdd === 0 || form.d32hdd === '' ? '' : form.d32hdd}
              onChange={e => { const val = e.target.value; f('d32hdd', val === '' ? 0 : Number(val)); }}
              onBlur={e => { if (e.target.value === '') f('d32hdd', 0); }}
              placeholder="0"
              style={{ textAlign: 'center', height: 28 }} />
            <div style={{ height: 28, border: '1px solid #e2e8f0', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f7ee', fontSize: 12, fontWeight: 700, color: '#1f4e1a' }}>{d32Total}</div>

            {/* Row 3: Ø63 */}
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#1f4e1a' }}>Ø63mm</div>
            <Input type="number" min={0} value={form.d63oc === 0 || form.d63oc === '' ? '' : form.d63oc}
              onChange={e => { const val = e.target.value; f('d63oc', val === '' ? 0 : Number(val)); }}
              onBlur={e => { if (e.target.value === '') f('d63oc', 0); }}
              placeholder="0"
              style={{ textAlign: 'center', height: 28 }} />
            <Input type="number" min={0} value={form.d63b === 0 || form.d63b === '' ? '' : form.d63b}
              onChange={e => { const val = e.target.value; f('d63b', val === '' ? 0 : Number(val)); }}
              onBlur={e => { if (e.target.value === '') f('d63b', 0); }}
              placeholder="0"
              style={{ textAlign: 'center', height: 28 }} />
            <Input type="number" min={0} value={form.d63hdd === 0 || form.d63hdd === '' ? '' : form.d63hdd}
              onChange={e => { const val = e.target.value; f('d63hdd', val === '' ? 0 : Number(val)); }}
              onBlur={e => { if (e.target.value === '') f('d63hdd', 0); }}
              placeholder="0"
              style={{ textAlign: 'center', height: 28 }} />
            <div style={{ height: 28, border: '1px solid #e2e8f0', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f7ee', fontSize: 12, fontWeight: 700, color: '#1f4e1a' }}>{d63Total}</div>

            {/* Row 4: Ø90 */}
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#1f4e1a' }}>Ø90mm</div>
            <Input type="number" min={0} value={form.d90oc === 0 || form.d90oc === '' ? '' : form.d90oc}
              onChange={e => { const val = e.target.value; f('d90oc', val === '' ? 0 : Number(val)); }}
              onBlur={e => { if (e.target.value === '') f('d90oc', 0); }}
              placeholder="0"
              style={{ textAlign: 'center', height: 28 }} />
            <Input type="number" min={0} value={form.d90b === 0 || form.d90b === '' ? '' : form.d90b}
              onChange={e => { const val = e.target.value; f('d90b', val === '' ? 0 : Number(val)); }}
              onBlur={e => { if (e.target.value === '') f('d90b', 0); }}
              placeholder="0"
              style={{ textAlign: 'center', height: 28 }} />
            <Input type="number" min={0} value={form.d90hdd === 0 || form.d90hdd === '' ? '' : form.d90hdd}
              onChange={e => { const val = e.target.value; f('d90hdd', val === '' ? 0 : Number(val)); }}
              onBlur={e => { if (e.target.value === '') f('d90hdd', 0); }}
              placeholder="0"
              style={{ textAlign: 'center', height: 28 }} />
            <div style={{ height: 28, border: '1px solid #e2e8f0', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f7ee', fontSize: 12, fontWeight: 700, color: '#1f4e1a' }}>{d90Total}</div>

            {/* Row 5: Ø125 */}
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#1f4e1a' }}>Ø125mm</div>
            <Input type="number" min={0} value={form.d125oc === 0 || form.d125oc === '' ? '' : form.d125oc}
              onChange={e => { const val = e.target.value; f('d125oc', val === '' ? 0 : Number(val)); }}
              onBlur={e => { if (e.target.value === '') f('d125oc', 0); }}
              placeholder="0"
              style={{ textAlign: 'center', height: 28 }} />
            <Input type="number" min={0} value={form.d125b === 0 || form.d125b === '' ? '' : form.d125b}
              onChange={e => { const val = e.target.value; f('d125b', val === '' ? 0 : Number(val)); }}
              onBlur={e => { if (e.target.value === '') f('d125b', 0); }}
              placeholder="0"
              style={{ textAlign: 'center', height: 28 }} />
            <Input type="number" min={0} value={form.d125hdd === 0 || form.d125hdd === '' ? '' : form.d125hdd}
              onChange={e => { const val = e.target.value; f('d125hdd', val === '' ? 0 : Number(val)); }}
              onBlur={e => { if (e.target.value === '') f('d125hdd', 0); }}
              placeholder="0"
              style={{ textAlign: 'center', height: 28 }} />
            <div style={{ height: 28, border: '1px solid #e2e8f0', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f7ee', fontSize: 12, fontWeight: 700, color: '#1f4e1a' }}>{d125Total}</div>
          </div>
        </div>

        {customCols.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <SectionTitle>Additional Information</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {customCols.map(col => (
                <Field key={col.key} label={col.label}>
                  <Input value={form[col.key] || ''} onChange={e => f(col.key, e.target.value)} />
                </Field>
              ))}
            </div>
          </div>
        )}

        {/* Delete button for edit mode */}
        {editingId !== null && (
          <div style={{ marginTop: 16, borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
            <button
              type="button"
              onClick={() => setShowDelete(true)}
              style={{ width: '100%', height: 36, background: '#fff', color: '#dc2626', border: '1px solid #dc2626', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              🗑 Delete this entry
            </button>
          </div>
        )}
      </SlidePanel>

      {/* Delete Confirm */}
      {showDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, maxWidth: 360, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🗑</div>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>Delete this entry permanently?</p>
            <p style={{ fontSize: 12, color: '#64748b', marginBottom: 20 }}>This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowDelete(false)} style={{ flex: 1, height: 38, background: '#f1f5f9', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>Cancel</button>
              <button onClick={handleDelete} style={{ flex: 1, height: 38, background: '#c0440a', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#fff' }}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Column Manager Modal ── */}
      {showColManager && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:9000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={() => setShowColManager(false)}>
          <div style={{ background:'#fff', borderRadius:12, padding:28, maxWidth:420, width:'100%', boxShadow:'0 20px 60px rgba(0,0,0,0.25)', maxHeight:'85vh', overflowY:'auto', margin:'auto' }}
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
                        localStorage.setItem('gppms_custom_columns_pelaying', JSON.stringify(updated));
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
                <input id="newColInputPL" placeholder="Column name..."
                  style={{ flex:1, height:34, border:'1px solid #d1d5db', borderRadius:6, padding:'0 10px', fontSize:13 }} />
                <button onClick={() => {
                  const val = document.getElementById('newColInputPL')?.value?.trim();
                  if (!val) return;
                  const newCol = { key: 'custom_' + Date.now(), label: val };
                  const updated = [...customCols, newCol];
                  setCustomCols(updated);
                  localStorage.setItem('gppms_custom_columns_pelaying', JSON.stringify(updated));
                  document.getElementById('newColInputPL').value = '';
                  showToast(`✓ Column "${val}" added`);
                }} style={{ height:34, background:'#2d6a27', color:'#fff', border:'none', borderRadius:6, padding:'0 14px', fontSize:13, fontWeight:600, cursor:'pointer' }}>+ Add</button>
              </div>
            </div>

            <button onClick={() => { setHiddenCols([]); localStorage.removeItem('gppms_hidden_cols_pelaying'); showToast('All columns visible'); }}
              style={{ marginTop:14, width:'100%', height:32, background:'#f1f5f9', color:'#374151', border:'1px solid #e2e8f0', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer' }}>
              ↺ Reset — Show All Columns
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
