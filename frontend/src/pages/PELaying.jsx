// src/pages/PELaying.jsx
import { useState, useMemo, useEffect } from 'react';
import defaultPeLaying from '../data/peLaying';
import { exportPELaying } from '../utils/exportExcel';
import SlidePanel, { Field, Input, Select, SectionTitle } from '../components/SlidePanel';
import { useToast } from '../components/Toast';
import { useSite } from '../context/SiteContext';
import { gaLocations, getCitiesForGA, getAreasForCity } from '../data/gaLocations';

function initStore(key, defaults) {
  try {
    const raw = localStorage.getItem('gppms_' + key);
    if (!raw) { localStorage.setItem('gppms_' + key, JSON.stringify(defaults)); return defaults; }
    return JSON.parse(raw);
  } catch { return defaults; }
}

const todayStr = () => new Date().toISOString().split('T')[0];

// Work Status — only 3 options
const WK_STATUSES = ['Nil', 'Testing & Flushing', 'Commissioning'];
const CONN_TYPES   = ['Domestic', 'Commercial', 'Industrial'];

const FLOOR_LABELS = { GF: 'Ground Floor', FF: 'First Floor', SF: 'Second Floor', TF: 'Third Floor', FoF: 'Fourth Floor' };

const EMPTY_ENTRY = {
  layDate: '', connType: 'Domestic', area: '', coil: '',
  d32oc: 0, d32b: 0, d32hdd: 0,
  d63oc: 0, d63b: 0, d63hdd: 0,
  d90tot: 0, d125tot: 0,
  workStatus: 'Nil',
};

export default function PELaying() {
  const { showToast } = useToast();
  const { siteList }  = useSite();
  const [allData, setAllData] = useState([]);

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
  const n = (key, val) => setForm(prev => ({ ...prev, [key]: Number(val) || 0 }));

  // ── KPI totals (all data) ──
  const kpiTotals = useMemo(() => allData.reduce((acc, r) => ({
    d32:  acc.d32  + (r.d32oc || 0)  + (r.d32b || 0)  + (r.d32hdd || 0),
    d63:  acc.d63  + (r.d63oc || 0)  + (r.d63b || 0)  + (r.d63hdd || 0),
    d90:  acc.d90  + (r.d90tot  || 0),
    d125: acc.d125 + (r.d125tot || 0),
  }), { d32: 0, d63: 0, d90: 0, d125: 0 }), [allData]);

  // ── Filtered rows (by tab + area) ──
  const filtered = useMemo(() => allData.filter(r => {
    const tab = r.connType || 'Domestic';
    if (tab !== activeTab) return false;
    if (filterArea && !(r.area || '').toLowerCase().includes(filterArea.toLowerCase())) return false;
    return true;
  }), [allData, activeTab, filterArea]);

  // ── Column totals ──
  const totals = useMemo(() => filtered.reduce((acc, r) => ({
    d32oc:  acc.d32oc  + (r.d32oc  || 0),
    d32b:   acc.d32b   + (r.d32b   || 0),
    d32hdd: acc.d32hdd + (r.d32hdd || 0),
    d32t:   acc.d32t   + (r.d32oc  || 0) + (r.d32b || 0) + (r.d32hdd || 0),
    d63oc:  acc.d63oc  + (r.d63oc  || 0),
    d63b:   acc.d63b   + (r.d63b   || 0),
    d63h:   acc.d63h   + (r.d63hdd || 0),
    d63t:   acc.d63t   + (r.d63oc  || 0) + (r.d63b || 0) + (r.d63hdd || 0),
    d90:    acc.d90    + (r.d90tot || 0),
    d125:   acc.d125   + (r.d125tot || 0),
  }), { d32oc:0,d32b:0,d32hdd:0,d32t:0,d63oc:0,d63b:0,d63h:0,d63t:0,d90:0,d125:0 }), [filtered]);

  function handleExport() { exportPELaying(filtered, exportFromDate, exportToDate); }

  function validateForm() {
    const e = {};
    if (!form.layDate)        e.layDate   = 'Laying Date is required';
    if (!form.connType)       e.connType  = 'Connection Type is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function openAddPanel() {
    setEditingId(null);
    setForm(EMPTY_ENTRY);
    setErrors({});
    setPanelOpen(true);
  }

  function openEditPanel(row) {
    setEditingId(row.id || row.sr);
    setForm({
      layDate:    row.layDate    || '',
      connType:   row.connType   || 'Domestic',
      area:       row.area       || '',
      coil:       row.coil       || '',
      d32oc:      row.d32oc      || 0,
      d32b:       row.d32b       || 0,
      d32hdd:     row.d32hdd     || 0,
      d63oc:      row.d63oc      || 0,
      d63b:       row.d63b       || 0,
      d63hdd:     row.d63hdd     || 0,
      d90tot:     row.d90tot     || 0,
      d125tot:    row.d125tot    || 0,
      workStatus: row.workStatus || 'Nil',
    });
    setErrors({});
    setPanelOpen(true);
  }

  function handleSave() {
    if (!validateForm()) return;
    const entryBase = {
      ...form,
      d32oc:  Number(form.d32oc)   || 0,
      d32b:   Number(form.d32b)    || 0,
      d32hdd: Number(form.d32hdd)  || 0,
      d63oc:  Number(form.d63oc)   || 0,
      d63b:   Number(form.d63b)    || 0,
      d63hdd: Number(form.d63hdd)  || 0,
      d90tot: Number(form.d90tot)  || 0,
      d125tot:Number(form.d125tot) || 0,
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

  const d32Total = (Number(form.d32oc) || 0) + (Number(form.d32b) || 0) + (Number(form.d32hdd) || 0);
  const d63Total = (Number(form.d63oc) || 0) + (Number(form.d63b) || 0) + (Number(form.d63hdd) || 0);
  const num = v => (v > 0 ? v : <span style={{ color: '#cbd5e1' }}>—</span>);

  return (
    <div>
      {/* Title + Add button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1f4e1a', margin: 0 }}>PE Laying — Pipeline Progress</h1>
        <button onClick={openAddPanel}
          style={{ height: 34, background: '#1f4e1a', color: '#fff', border: 'none', borderRadius: 5, padding: '0 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          + Add Laying Entry
        </button>
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
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {CONN_TYPES.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ padding: '5px 18px', borderRadius: 5, fontSize: 12, fontWeight: 600, border: activeTab === tab ? 'none' : '1px solid #d1d5db', background: activeTab === tab ? '#2d6a27' : '#fff', color: activeTab === tab ? '#fff' : '#64748b', cursor: 'pointer', transition: 'all 0.15s' }}>
            {tab}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="card section-block" style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <input className="gp-input" placeholder="Filter by Area..."
          style={{ width: 160 }} value={filterArea}
          onChange={e => setFilterArea(e.target.value)} />
        <button className="btn btn-primary" onClick={() => setFilterArea('')}>Clear</button>

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
                <th>Laying Date</th>
                <th>Area</th>
                <th>Coil/Batch No.</th>
                <th style={{ textAlign: 'right' }}>Ø32 Laying</th>
                <th style={{ textAlign: 'right' }}>Ø32 Boring</th>
                <th style={{ textAlign: 'right' }}>Ø32 HDD</th>
                <th style={{ textAlign: 'right' }}>Ø63 Laying</th>
                <th style={{ textAlign: 'right' }}>Ø63 Boring</th>
                <th style={{ textAlign: 'right' }}>Ø63 HDD</th>
                <th style={{ textAlign: 'right' }}>Ø90</th>
                <th style={{ textAlign: 'right' }}>Ø125</th>
                <th>Work Status</th>
                <th style={{ width: 40 }}>✏</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={14} style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                  <div style={{ fontSize: 32 }}>🚧</div>
                  <div style={{ marginTop: 8 }}>No {activeTab} entries found</div>
                </td></tr>
              ) : filtered.map((r, idx) => {
                const wsColor = r.workStatus === 'Commissioning' ? '#16a34a' : r.workStatus === 'Testing & Flushing' ? '#1d4ed8' : '#94a3b8';
                return (
                  <tr key={r.id || r.sr}>
                    <td style={{ textAlign: 'center', color: '#94a3b8' }}>{idx + 1}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.layDate}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{r.area}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.coil || '—'}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{num(r.d32oc || 0)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{num(r.d32b || 0)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{num(r.d32hdd || 0)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{num(r.d63oc || 0)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{num(r.d63b || 0)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{num(r.d63hdd || 0)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{num(r.d90tot || 0)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{num(r.d125tot || 0)}</td>
                    <td>
                      {r.workStatus && r.workStatus !== 'Nil' ? (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: r.workStatus === 'Commissioning' ? '#dcfce7' : '#dbeafe', color: wsColor }}>{r.workStatus}</span>
                      ) : <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>
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
                  <td colSpan={4} style={{ fontWeight: 700, color: '#1f4e1a', textAlign: 'right', fontSize: 12 }}>TOTAL</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{totals.d32oc}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{totals.d32b}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{totals.d32hdd}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{totals.d63oc}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{totals.d63b}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{totals.d63h}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{totals.d90}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{totals.d125}</td>
                  <td colSpan={2} />
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Laying Date" required error={errors.layDate}>
              <Input type="date" value={form.layDate} onChange={e => f('layDate', e.target.value)} error={errors.layDate} />
            </Field>
            <Field label="Connection Type" required error={errors.connType}>
              <Select value={form.connType} onChange={e => f('connType', e.target.value)} error={errors.connType}>
                {CONN_TYPES.map(t => <option key={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="Area / Society">
              <Input value={form.area} onChange={e => f('area', e.target.value)} placeholder="e.g. UE-II Block A" />
            </Field>
            <Field label="Coil / Batch No.">
              <Input value={form.coil} onChange={e => f('coil', e.target.value)} />
            </Field>
            <Field label="Work Status">
              <Select value={form.workStatus} onChange={e => f('workStatus', e.target.value)}>
                {WK_STATUSES.map(s => <option key={s}>{s}</option>)}
              </Select>
            </Field>
          </div>
        </div>

        <div>
          <SectionTitle>Pipe Quantities (metres)</SectionTitle>
          {/* Ø32mm */}
          <p style={{ fontSize: 11, fontWeight: 600, color: '#1f4e1a', marginBottom: 6 }}>Ø32mm</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
            <Field label="Open Cut / Laying">
              <Input type="number" min={0} value={form.d32oc} onChange={e => n('d32oc', e.target.value)} />
            </Field>
            <Field label="Boring">
              <Input type="number" min={0} value={form.d32b} onChange={e => n('d32b', e.target.value)} />
            </Field>
            <Field label="HDD">
              <Input type="number" min={0} value={form.d32hdd} onChange={e => n('d32hdd', e.target.value)} />
            </Field>
            <Field label="Total (auto)">
              <div style={{ height: 34, border: '1px solid #e2e8f0', borderRadius: 5, padding: '0 10px', display: 'flex', alignItems: 'center', background: '#f0f7ee', fontSize: 13, fontWeight: 700, color: '#1f4e1a' }}>{d32Total}</div>
            </Field>
          </div>

          {/* Ø63mm */}
          <p style={{ fontSize: 11, fontWeight: 600, color: '#1f4e1a', marginBottom: 6 }}>Ø63mm</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
            <Field label="Open Cut / Laying">
              <Input type="number" min={0} value={form.d63oc} onChange={e => n('d63oc', e.target.value)} />
            </Field>
            <Field label="Boring">
              <Input type="number" min={0} value={form.d63b} onChange={e => n('d63b', e.target.value)} />
            </Field>
            <Field label="HDD">
              <Input type="number" min={0} value={form.d63hdd} onChange={e => n('d63hdd', e.target.value)} />
            </Field>
            <Field label="Total (auto)">
              <div style={{ height: 34, border: '1px solid #e2e8f0', borderRadius: 5, padding: '0 10px', display: 'flex', alignItems: 'center', background: '#f0f7ee', fontSize: 13, fontWeight: 700, color: '#1f4e1a' }}>{d63Total}</div>
            </Field>
          </div>

          {/* Ø90 + Ø125 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Ø90mm — Total">
              <Input type="number" min={0} value={form.d90tot} onChange={e => n('d90tot', e.target.value)} />
            </Field>
            <Field label="Ø125mm — Total">
              <Input type="number" min={0} value={form.d125tot} onChange={e => n('d125tot', e.target.value)} />
            </Field>
          </div>
        </div>

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
    </div>
  );
}
