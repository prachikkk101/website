import { useState, useMemo, useEffect, useContext } from 'react';
import defaultStockData from '../data/stockData';
import { exportStockData } from '../utils/exportExcel';
import SlidePanel, { Field, Input, Select, SectionTitle } from '../components/SlidePanel';
import { useToast } from '../components/Toast';
import { AuthContext } from '../context/AuthContext';
import { stockCategories } from '../data/stockCategories';
import { useSite } from '../context/SiteContext';

const todayStr = () => new Date().toISOString().split('T')[0];

const DEFAULT_COLS = [
  { key: 'open',    label: 'Opening' },
  { key: 'recv',    label: 'Received' },
  { key: 'issued',  label: 'Issued' },
  { key: 'ret',     label: 'Returned' },
  { key: 'netUsed', label: 'Net Used' },
  { key: 'onSite',  label: 'On Site' },
  { key: 'inStore', label: 'In Store' },
  { key: 'req',     label: 'Required' },
];


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

function getStatus(onSite, inStore, open, recv) {
  const total = open + recv;
  const pct = total > 0 ? Math.round(((onSite + inStore) / total) * 100) : 0;
  if (pct > 60) return { label: 'OK',       cls: 'badge-ok',       bar: '#16a34a', pct };
  if (pct >= 20) return { label: 'Low',      cls: 'badge-low',      bar: '#d97706', pct };
  return              { label: 'Critical', cls: 'badge-critical', bar: '#dc2626', pct };
}


/* ── Category Accordion for Receive Stock ── */
function CategoryAccordion({ openCategory, setOpenCategory, quantities, setQuantities }) {
  // Load categories from localStorage so custom items persist
  const [categories, setCategories] = useState(() => {
    try {
      const saved = localStorage.getItem('gppms_stock_categories');
      return saved ? JSON.parse(saved) : stockCategories;
    } catch { return stockCategories; }
  });

  function toggleCategory(id) {
    setOpenCategory(prev => prev === id ? null : id);
  }

  function updateQty(catId, item, qty) {
    setQuantities(prev => ({ ...prev, [`${catId}__${item}`]: qty }));
  }

  function handleAddItem(catId) {
    const name = prompt('Enter new material name to add to this category:');
    if (!name || !name.trim()) return;
    const updated = categories.map(cat =>
      cat.id === catId
        ? { ...cat, items: [...cat.items, name.trim()] }
        : cat
    );
    setCategories(updated);
    localStorage.setItem('gppms_stock_categories', JSON.stringify(updated));
  }

  function handleRemoveItem(catId, itemName) {
    if (!window.confirm(`Remove "${itemName}" from this category?`)) return;
    const updated = categories.map(cat =>
      cat.id === catId
        ? { ...cat, items: cat.items.filter(i => i !== itemName) }
        : cat
    );
    setCategories(updated);
    localStorage.setItem('gppms_stock_categories', JSON.stringify(updated));
  }

  return (
    <div>
      {categories.map(cat => {
        const isOpen = openCategory === cat.id;
        return (
          <div key={cat.id} style={{ border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden', marginBottom: 8 }}>
            {/* Accordion header */}
            <div
              onClick={() => toggleCategory(cat.id)}
              style={{
                background: isOpen ? cat.color : '#f8fafc',
                color: isOpen ? 'white' : '#1e293b',
                padding: '12px 16px', cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontWeight: 600, fontSize: 13,
                transition: 'background 0.2s',
              }}
            >
              <span>{cat.label}</span>
              <span style={{ fontSize: 14 }}>{isOpen ? '\u25b2' : '\u25bc'}</span>
            </div>

            {/* Expanded items */}
            {isOpen && (
              <div style={{ padding: '12px 16px', background: 'white' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                  {cat.items.map(item => (
                    <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <label style={{ fontSize: 11.5, flex: 1, color: '#374151', lineHeight: 1.3 }}>{item}</label>
                      <input
                        type="number" min="0"
                        defaultValue={0}
                        onChange={e => updateQty(cat.id, item, Number(e.target.value))}
                        style={{ width: 70, height: 28, border: '1px solid #d1d5db', borderRadius: 4, padding: '0 6px', fontSize: 12, textAlign: 'right' }}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(cat.id, item)}
                        title={`Remove "${item}"`}
                        style={{ width: 26, height: 28, background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                      >×</button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => handleAddItem(cat.id)}
                  style={{ width: '100%', height: 30, background: '#f0f7ee', color: '#2d6a27', border: '1px dashed #2d6a27', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  + Add Item to {cat.label}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Inventory() {
  const { showToast } = useToast();
  const { user }      = useContext(AuthContext);
  const { siteList }  = useSite();

  const sites = useMemo(() => {
    return siteList.map(s => s.name);
  }, [siteList]);

  const [stockData, setStockData] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [exportDate, setExportDate] = useState(todayStr());

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

  // Delivery form state
  const [challan, setChallan] = useState('');
  const [dateRcv, setDateRcv] = useState(todayStr());
  const [site,    setSite]    = useState('');
  const [notes,   setNotes]   = useState('');
  const [formErr, setFormErr] = useState({});

  // Category accordion state
  const [openCategory,  setOpenCategory]  = useState(null);
  const [quantities,    setQuantities]    = useState({});

  useEffect(() => {
    document.title = 'GP-PMS \u2014 Stock Management';
    setStockData(initStore('stock', defaultStockData));
  }, []);

  useEffect(() => {
    if (sites.length > 0 && !site) {
      setSite(sites[0]);
    }
  }, [sites, site]);

  const rows = useMemo(() => (stockData || []).map(s => {
    const netUsed = s.issued - s.ret;
    const status  = getStatus(s.onSite, s.inStore, s.open, s.recv);
    const onSitePct = (s.open + s.recv) > 0 ? (s.onSite / (s.open + s.recv)) * 100 : 0;
    return { ...s, netUsed, status, onSitePct };
  }), [stockData]);

  const totals = useMemo(() => (rows || []).reduce((acc, r) => ({
    open: acc.open + r.open, recv: acc.recv + r.recv,
    issued: acc.issued + r.issued, ret: acc.ret + r.ret,
    netUsed: acc.netUsed + r.netUsed, onSite: acc.onSite + r.onSite,
    inStore: acc.inStore + r.inStore, req: acc.req + r.req,
  }), { open:0, recv:0, issued:0, ret:0, netUsed:0, onSite:0, inStore:0, req:0 }), [rows]);

  function openPanel() {
    setQuantities({});
    setOpenCategory(null);
    setChallan(''); setDateRcv(todayStr()); setSite(sites[0] || ''); setNotes(''); setFormErr({});
    setPanelOpen(true);
  }

  function handleSave() {
    const e = {};
    if (!dateRcv)        e.dateRcv = 'Date is required';
    setFormErr(e);
    if (Object.keys(e).length > 0) return;

    // Collect items with qty > 0
    const receivedItems = [];
    Object.entries(quantities).forEach(([key, qty]) => {
      if (qty > 0) {
        const [, ...itemParts] = key.split('__');
        receivedItems.push({ name: itemParts.join('__'), qty });
      }
    });

    if (receivedItems.length === 0) {
      showToast('\u26a0 No quantities entered');
      return;
    }

    // Update existing items or add new rows
    let updatedStock = [...(stockData || [])];
    let updatedCount = 0;

    receivedItems.forEach(({ name, qty }) => {
      const idx = updatedStock.findIndex(s => s.mat === name || s.material === name);
      if (idx >= 0) {
        updatedStock[idx] = { ...updatedStock[idx], recv: (updatedStock[idx].recv || 0) + qty };
        updatedCount++;
      } else {
        // New item
        updatedStock.push({
          sr: updatedStock.length + 1,
          mat: name, material: name,
          unit: 'pcs', open: 0,
          recv: qty, issued: 0, ret: 0,
          onSite: qty, inStore: 0, req: 0,
        });
        updatedCount++;
      }
    });

    setStockData(updatedStock);
    localStorage.setItem('gppms_stock', JSON.stringify(updatedStock));
    setPanelOpen(false);
    showToast(`\u2713 Stock received \u2014 ${updatedCount} items updated`);
  }

  const [customCols, setCustomCols] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('gppms_custom_columns_inventory') || '[]');
    } catch { return []; }
  });

  const [hiddenCols, setHiddenCols] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gppms_hidden_cols_inventory') || '[]'); } catch { return []; }
  });
  const [showColManager, setShowColManager] = useState(false);

  function toggleColVisibility(key) {
    const updated = hiddenCols.includes(key)
      ? hiddenCols.filter(k => k !== key)
      : [...hiddenCols, key];
    setHiddenCols(updated);
    localStorage.setItem('gppms_hidden_cols_inventory', JSON.stringify(updated));
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
    localStorage.setItem('gppms_custom_columns_inventory', JSON.stringify(updated));
    showToast(`✓ Column "${name.trim()}" added`);
  };

  const handleRemoveColumn = () => {
    if (customCols.length === 0) { showToast('⚠ No custom columns to remove'); return; }
    const options = customCols.map((c, i) => `${i + 1}. ${c.label}`).join('\n');
    const choice = prompt(`Which column to remove? Enter number:\n${options}`);
    if (!choice) return;
    const idx = parseInt(choice, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= customCols.length) { showToast('⚠ Invalid selection'); return; }
    const removed = customCols[idx];
    const updated = customCols.filter((_, i) => i !== idx);
    setCustomCols(updated);
    localStorage.setItem('gppms_custom_columns_inventory', JSON.stringify(updated));
    showToast(`✓ Column "${removed.label}" removed`);
  };

  const handleEditCell = (itemSr, colKey, colLabel, currentVal) => {
    if (!canWrite) return;
    const newVal = prompt(`Enter ${colLabel} for this item:`, currentVal || '');
    if (newVal === null) return;
    const updated = stockData.map(s => {
      if (s.sr === itemSr) {
        return { ...s, [colKey]: newVal.trim() };
      }
      return s;
    });
    setStockData(updated);
    localStorage.setItem('gppms_stock', JSON.stringify(updated));
    showToast('✓ Value updated');
  };

  function onSiteColor(r) {
    if (r.onSitePct < 20) return '#dc2626';
    if (r.onSitePct < 40) return '#d97706';
    return '#1e293b';
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1f4e1a', margin: 0 }}>Stock Statement</h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '2px 0 0' }}>{rows.length} materials tracked</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>Export as of</span>
          <input type="date" value={exportDate} onChange={e => setExportDate(e.target.value)}
            style={{ height: 32, border: '1px solid #d1d5db', borderRadius: 4, padding: '0 8px', fontSize: 12 }} />
          <button onClick={() => exportStockData(rows, exportDate)} className="btn btn-outline" style={{ height: 32 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export
          </button>
          {canWrite && (
            <>
              <button onClick={handleAddColumn} className="btn btn-primary" style={{ height: 32, fontSize: 12 }}>
                ➕ Add Column
              </button>
              {customCols.length > 0 && (
                <button
                  onClick={handleRemoveColumn}
                  style={{
                    height: 32, background: '#fee2e2', color: '#dc2626',
                    border: '1px solid #fca5a5', borderRadius: 4,
                    padding: '0 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  ✕ Remove Column
                </button>
              )}
              <button onClick={() => setShowColManager(true)}
                style={{ height: 32, background: '#2d6a27', color: '#fff', border: 'none', borderRadius: 4, padding: '0 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                ⚙ Manage Columns
              </button>
              <button onClick={openPanel} className="btn btn-primary" style={{ height: 32 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Receive Stock
              </button>
            </>
          )}
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="gp-table">
            <thead>
              <tr>
                <th style={{ width: 40, textAlign:'center' }}>Sr.</th>
                <th style={{ minWidth: 180 }}>Material</th>
                <th style={{ width: 60 }}>Unit</th>
                {!hiddenCols.includes('open') && <th style={{ textAlign:'right' }}>Opening</th>}
                {!hiddenCols.includes('recv') && <th style={{ textAlign:'right' }}>Received</th>}
                {!hiddenCols.includes('issued') && <th style={{ textAlign:'right' }}>Issued</th>}
                {!hiddenCols.includes('ret') && <th style={{ textAlign:'right' }}>Returned</th>}
                {!hiddenCols.includes('netUsed') && <th style={{ textAlign:'right' }}>Net Used</th>}
                {!hiddenCols.includes('onSite') && <th style={{ textAlign:'right' }}>On Site</th>}
                {!hiddenCols.includes('inStore') && <th style={{ textAlign:'right' }}>In Store</th>}
                {!hiddenCols.includes('req') && <th style={{ textAlign:'right' }}>Required</th>}
                {customCols.filter(c => !hiddenCols.includes(c.key)).map(col => <th key={col.key}>{col.label}</th>)}
                <th style={{ minWidth: 140 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={12 + customCols.length} style={{ textAlign:'center', padding:'40px 0', color:'#94a3b8' }}>
                  <div style={{ fontSize: 32 }}>📦</div>
                  <div style={{ marginTop: 8 }}>No stock data found</div>
                </td></tr>
              ) : rows.map(r => (
                <tr key={r.sr}>
                  <td style={{ textAlign:'center', color:'#94a3b8', fontWeight:500 }}>{r.sr}</td>
                  <td style={{ fontWeight:600, whiteSpace:'nowrap' }}>{r.mat}</td>
                  <td style={{ color:'#64748b' }}>{r.unit}</td>
                  {!hiddenCols.includes('open') && <td style={{ textAlign:'right' }}>{(r.open||0).toLocaleString()}</td>}
                  {!hiddenCols.includes('recv') && <td style={{ textAlign:'right', color:'#2d6a27', fontWeight:600 }}>{(r.recv||0).toLocaleString()}</td>}
                  {!hiddenCols.includes('issued') && <td style={{ textAlign:'right' }}>{(r.issued||0).toLocaleString()}</td>}
                  {!hiddenCols.includes('ret') && <td style={{ textAlign:'right', color:'#2d6a27' }}>{(r.ret||0).toLocaleString()}</td>}
                  {!hiddenCols.includes('netUsed') && <td style={{ textAlign:'right', fontWeight:700 }}>{(r.netUsed||0).toLocaleString()}</td>}
                  {!hiddenCols.includes('onSite') && <td style={{ textAlign:'right', color: onSiteColor(r) }}>{(r.onSite||0).toLocaleString()}</td>}
                  {!hiddenCols.includes('inStore') && <td style={{ textAlign:'right' }}>{(r.inStore||0).toLocaleString()}</td>}
                  {!hiddenCols.includes('req') && <td style={{ textAlign:'right', color: r.req > 0 ? '#c0440a' : '#94a3b8', fontWeight: r.req > 0 ? 600 : 400 }}>{r.req > 0 ? r.req.toLocaleString() : '—'}</td>}
                  {customCols.filter(col => !hiddenCols.includes(col.key)).map(col => (
                    <td
                      key={col.key}
                      onClick={() => handleEditCell(r.sr, col.key, col.label, r[col.key])}
                      style={{
                        cursor: canWrite ? 'pointer' : 'default',
                        color: r[col.key] ? '#1e293b' : '#94a3b8',
                        fontStyle: r[col.key] ? 'normal' : 'italic',
                        background: canWrite ? 'rgba(45, 106, 39, 0.02)' : 'none',
                        whiteSpace: 'nowrap'
                      }}
                      title={canWrite ? 'Click to edit' : undefined}
                    >
                      {r[col.key] || (canWrite ? 'click to set' : '—')}
                    </td>
                  ))}
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:80, height:8, background:'#e5e7eb', borderRadius:4, overflow:'hidden', flexShrink:0 }}>
                        <div style={{ height:'100%', width:`${Math.min(r.status.pct,100)}%`, background:r.status.bar, borderRadius:4, transition:'width 0.6s' }} />
                      </div>
                      <span className={`badge ${r.status.cls}`}>{r.status.label}</span>
                    </div>
                  </td>
                </tr>
              ))}
              <tr style={{ background:'#f0f7ee', fontWeight:700 }}>
                <td colSpan={3} style={{ textAlign:'right', color:'#1f4e1a' }}>TOTAL</td>
                {!hiddenCols.includes('open') && <td style={{ textAlign:'right' }}>{totals.open.toLocaleString()}</td>}
                {!hiddenCols.includes('recv') && <td style={{ textAlign:'right', color:'#2d6a27' }}>{totals.recv.toLocaleString()}</td>}
                {!hiddenCols.includes('issued') && <td style={{ textAlign:'right' }}>{totals.issued.toLocaleString()}</td>}
                {!hiddenCols.includes('ret') && <td style={{ textAlign:'right', color:'#2d6a27' }}>{totals.ret.toLocaleString()}</td>}
                {!hiddenCols.includes('netUsed') && <td style={{ textAlign:'right' }}>{totals.netUsed.toLocaleString()}</td>}
                {!hiddenCols.includes('onSite') && <td style={{ textAlign:'right' }}>{totals.onSite.toLocaleString()}</td>}
                {!hiddenCols.includes('inStore') && <td style={{ textAlign:'right' }}>{totals.inStore.toLocaleString()}</td>}
                {!hiddenCols.includes('req') && <td style={{ textAlign:'right' }}>{totals.req.toLocaleString()}</td>}
                {customCols.filter(col => !hiddenCols.includes(col.key)).map(col => <td key={col.key} />)}
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p style={{ marginTop:10, fontSize:12, color:'#94a3b8', fontStyle:'italic' }}>
        \u2139\ufe0f Materials used per house entry are automatically deducted from Issued Qty.
      </p>

      {/* Receive Stock Panel */}
      <SlidePanel isOpen={panelOpen} onClose={() => setPanelOpen(false)} title="Receive New Stock" onSave={handleSave}>
        <div>
          <SectionTitle>Delivery Details</SectionTitle>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <Field label="Challan / DC Number (optional)">
              <Input value={challan} onChange={e => setChallan(e.target.value)} placeholder="e.g. DC-2026-001" />
            </Field>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <Field label="Date Received" required error={formErr.dateRcv}>
                <Input type="date" value={dateRcv} onChange={e => setDateRcv(e.target.value)} error={formErr.dateRcv} />
              </Field>
              <Field label="Site">
                <Select value={site} onChange={e => setSite(e.target.value)}>
                  {sites.map(s => <option key={s}>{s}</option>)}
                </Select>
              </Field>
            </div>
          </div>
        </div>
        <div>
          <SectionTitle>Materials Received</SectionTitle>
          <p style={{ fontSize:11, color:'#64748b', marginBottom:10 }}>
            Click a category to expand. Enter quantities received (leave 0 to skip).
          </p>
          <CategoryAccordion
            openCategory={openCategory}
            setOpenCategory={setOpenCategory}
            quantities={quantities}
            setQuantities={setQuantities}
          />
        </div>
        <div>
          <SectionTitle>Notes / Remarks</SectionTitle>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Optional notes about this delivery..." rows={3}
            style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:5, padding:'8px 10px', fontSize:13, resize:'vertical', boxSizing:'border-box' }} />
        </div>
      </SlidePanel>

      {/* ── Column Manager Modal ── */}
      {showColManager && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:9000, display:'flex', alignItems:'center', justifyContext:'center', padding:20 }}
          onClick={() => setShowColManager(false)}>
          <div style={{ background:'#fff', borderRadius:12, padding:28, maxWidth:420, width:'100%', boxShadow:'0 20px 60px rgba(0,0,0,0.25)', maxHeight:'85vh', overflowY:'auto', margin:'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', justifyContext:'space-between', marginBottom:18 }}>
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
                        localStorage.setItem('gppms_custom_columns_inventory', JSON.stringify(updated));
                        setHiddenCols(prev => prev.filter(k => k !== col.key));
                        showToast(`Column "${col.label}" deleted`);
                      }} title="Delete this column permanently"
                        style={{ background:'#fee2e2', color:'#dc2626', border:'none', borderRadius:4, width:26, height:26, cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', justifyContext:'center', flexShrink:0 }}>×</button>
                    </div>
                  ))}
                </div>
              </>
            )}

            <button onClick={() => { setHiddenCols([]); localStorage.removeItem('gppms_hidden_cols_inventory'); showToast('All columns visible'); }}
              style={{ marginTop:14, width:'100%', height:32, background:'#f1f5f9', color:'#374151', border:'1px solid #e2e8f0', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer' }}>
              ↺ Reset — Show All Columns
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

