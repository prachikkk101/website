// src/pages/PELaying.jsx
import { useState, useMemo, useEffect } from 'react';
import defaultPeLaying from '../data/peLaying';
import { exportPELaying } from '../utils/exportExcel';
import SlidePanel, { Field, Input, Select, SectionTitle } from '../components/SlidePanel';
import { useToast } from '../components/Toast';

function initStore(key, defaults) {
  try {
    const raw = localStorage.getItem('gppms_' + key);
    if (!raw) { localStorage.setItem('gppms_' + key, JSON.stringify(defaults)); return defaults; }
    return JSON.parse(raw);
  } catch { return defaults; }
}

const SITES       = ['All Sites','Khanna CA-09','UE-II Hisar','PLA Hisar','Kohara CA-07'];
const DATE_RANGES = ['All Time','Last 30 Days','Last 90 Days','Custom'];
const STATUSES    = ['All','LAYING','HDD','JOINT'];
const WK_STATUSES = ['LAYING','HDD','JOINT'];

const STATUS_CLS  = { LAYING: 'badge-laying', HDD: 'badge-hdd', JOINT: 'badge-joint' };

const todayStr = () => new Date().toISOString().split('T')[0];

const EMPTY_ENTRY = {
  layDate:'', testDate:'', chargeDate:'',
  raBill:'', reportNo:'', status:'LAYING', area:'', landmark:'', coil:'', location:'',
  d32oc:0, d32b:0, d63oc:0, d63b:0, d63hdd:0, d90tot:0, d125tot:0,
};

export default function PELaying() {
  const { showToast } = useToast();
  const [allData, setAllData] = useState([]);

  useEffect(() => {
    document.title = 'GP-PMS — PE Laying';
    setAllData(initStore('pelaying', defaultPeLaying));
  }, []);

  const [site,      setSite]      = useState('All Sites');
  const [dateRange, setDateRange] = useState('All Time');
  const [raBill,    setRaBill]    = useState('');
  const [status,    setStatus]    = useState('All');

  // Export date state
  const [exportFromDate, setExportFromDate] = useState(todayStr());
  const [exportToDate,   setExportToDate]   = useState(todayStr());
  const dateError = exportFromDate && exportToDate && exportFromDate > exportToDate;

  // Add entry panel
  const [panelOpen, setPanelOpen] = useState(false);
  const [form,      setForm]      = useState(EMPTY_ENTRY);
  const [errors,    setErrors]    = useState({});

  const f = (key, val) => setForm(prev => ({ ...prev, [key]: val }));
  const n = (key, val) => setForm(prev => ({ ...prev, [key]: Number(val) || 0 }));

  const filtered = useMemo(() => allData.filter(r => {
    if (status !== 'All' && r.status !== status) return false;
    if (raBill  && !r.raBill.toLowerCase().includes(raBill.toLowerCase())) return false;
    return true;
  }), [allData, status, raBill]);

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

  /* KPI tiles — live from all data */
  const kpiTotals = useMemo(() => allData.reduce((acc, r) => ({
    d32: acc.d32 + r.d32oc + r.d32b,
    d63: acc.d63 + r.d63oc + r.d63b + r.d63hdd,
    d90: acc.d90 + r.d90tot,
    d125: acc.d125 + r.d125tot,
  }), { d32:0, d63:0, d90:0, d125:0 }), [allData]);

  function handleExport() {
    exportPELaying(filtered, exportFromDate, exportToDate);
  }

  function validateForm() {
    const e = {};
    if (!form.layDate) e.layDate = 'Laying Date is required';
    if (!form.status)  e.status  = 'Work Status is required';
    if (!form.area.trim()) e.area = 'Area is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validateForm()) return;
    const newEntry = {
      ...form,
      sr: (allData || []).length + 1,
      d32oc: Number(form.d32oc) || 0,
      d32b:  Number(form.d32b)  || 0,
      d63oc: Number(form.d63oc) || 0,
      d63b:  Number(form.d63b)  || 0,
      d63hdd:Number(form.d63hdd)|| 0,
      d90tot:Number(form.d90tot)|| 0,
      d125tot:Number(form.d125tot)||0,
    };
    const updated = [newEntry, ...(allData || [])];
    setAllData(updated);
    localStorage.setItem('gppms_pelaying', JSON.stringify(updated));
    setPanelOpen(false);
    setForm(EMPTY_ENTRY);
    setErrors({});
    showToast('✓ PE Laying entry added');
  }

  const d32Total  = (Number(form.d32oc)  || 0) + (Number(form.d32b)  || 0);
  const d63Total  = (Number(form.d63oc)  || 0) + (Number(form.d63b)  || 0) + (Number(form.d63hdd) || 0);

  return (
    <div>
      {/* Title + Add button row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1f4e1a', margin: 0 }}>PE Laying — Pipeline Progress</h1>
        <button
          onClick={() => setPanelOpen(true)}
          style={{
            height: 34, background: '#1f4e1a', color: '#fff', border: 'none',
            borderRadius: 5, padding: '0 16px', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          + Add Laying Entry
        </button>
      </div>

      {/* KPI Summary Row */}
      <div className="pe-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
        {[
          { label: 'Total Ø32mm Laid',  val: kpiTotals.d32  },
          { label: 'Total Ø63mm Laid',  val: kpiTotals.d63  },
          { label: 'Total Ø90mm Laid',  val: kpiTotals.d90  },
          { label: 'Total Ø125mm Laid', val: kpiTotals.d125 },
        ].map(k => (
          <div key={k.label} className="kpi-tile" style={{ background: '#2d6a27' }}>
            <p className="kpi-label">{k.label}</p>
            <p className="kpi-value" style={{ fontSize: 22 }}>{k.val.toLocaleString()} mtr</p>
          </div>
        ))}
      </div>

      {/* Filter bar + Export */}
      <div className="card section-block" style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <select className="gp-select" value={site} onChange={e => setSite(e.target.value)}>
          {SITES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="gp-select" value={dateRange} onChange={e => setDateRange(e.target.value)}>
          {DATE_RANGES.map(d => <option key={d}>{d}</option>)}
        </select>
        <input
          className="gp-input" placeholder="RA Bill No."
          style={{ width: 140 }} value={raBill}
          onChange={e => setRaBill(e.target.value)}
        />
        <select className="gp-select" value={status} onChange={e => setStatus(e.target.value)}>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <button className="btn btn-primary">Search</button>

        {/* Export with date range */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>Export entries from</span>
          <input
            type="date" value={exportFromDate}
            onChange={e => setExportFromDate(e.target.value)}
            style={{ height: 32, border: '1px solid #d1d5db', borderRadius: 4, padding: '0 8px', fontSize: 12 }}
          />
          <span style={{ fontSize: 12, color: '#64748b' }}>to</span>
          <input
            type="date" value={exportToDate}
            onChange={e => setExportToDate(e.target.value)}
            style={{ height: 32, border: '1px solid #d1d5db', borderRadius: 4, padding: '0 8px', fontSize: 12 }}
          />
          <button
            onClick={handleExport}
            disabled={!!dateError}
            style={{
              height: 32, background: dateError ? '#94a3b8' : '#2d6a27', color: '#fff',
              border: 'none', borderRadius: 4, padding: '0 14px', fontSize: 12,
              fontWeight: 600, cursor: dateError ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            ↓ Export Excel
          </button>
        </div>
      </div>

      {dateError && (
        <p style={{ fontSize: 11, color: '#ef4444', margin: '4px 0 8px' }}>From date cannot be after To date</p>
      )}

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="gp-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>Sr.</th>
                <th>Laying Date</th><th>Testing Date</th><th>Charging Date</th>
                <th>RA Bill No.</th><th>Report No.</th><th>Status</th>
                <th>Area/Society</th><th>Coil/Batch No.</th>
                <th style={{ textAlign:'right' }}>Ø32 OC</th>
                <th style={{ textAlign:'right' }}>Ø32 Boring</th>
                <th style={{ textAlign:'right' }}>Ø32 Total</th>
                <th style={{ textAlign:'right' }}>Ø63 OC</th>
                <th style={{ textAlign:'right' }}>Ø63 Boring</th>
                <th style={{ textAlign:'right' }}>Ø63 HDD</th>
                <th style={{ textAlign:'right' }}>Ø63 Total</th>
                <th style={{ textAlign:'right' }}>Ø90 Total</th>
                <th style={{ textAlign:'right' }}>Ø125 Total</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const d32t = r.d32oc + r.d32b;
                const d63t = r.d63oc + r.d63b + r.d63hdd;
                const num  = v => v > 0 ? v : <span style={{ color: '#cbd5e1' }}>—</span>;
                return (
                  <tr key={r.sr}>
                    <td style={{ textAlign:'center', color:'#94a3b8' }}>{r.sr}</td>
                    <td style={{ fontFamily:'monospace', fontSize:11 }}>{r.layDate}</td>
                    <td style={{ fontFamily:'monospace', fontSize:11 }}>{r.testDate}</td>
                    <td style={{ fontFamily:'monospace', fontSize:11 }}>{r.chargeDate}</td>
                    <td style={{ whiteSpace:'nowrap', fontSize:11 }}>{r.raBill}</td>
                    <td style={{ textAlign:'center' }}>{r.reportNo}</td>
                    <td><span className={`badge ${STATUS_CLS[r.status]}`}>{r.status}</span></td>
                    <td style={{ whiteSpace:'nowrap' }}>{r.area}</td>
                    <td style={{ fontFamily:'monospace', fontSize:11 }}>{r.coil}</td>
                    <td style={{ textAlign:'right', fontFamily:'monospace' }}>{num(r.d32oc)}</td>
                    <td style={{ textAlign:'right', fontFamily:'monospace' }}>{num(r.d32b)}</td>
                    <td style={{ textAlign:'right', fontFamily:'monospace', fontWeight:600 }}>{num(d32t)}</td>
                    <td style={{ textAlign:'right', fontFamily:'monospace' }}>{num(r.d63oc)}</td>
                    <td style={{ textAlign:'right', fontFamily:'monospace' }}>{num(r.d63b)}</td>
                    <td style={{ textAlign:'right', fontFamily:'monospace' }}>{num(r.d63hdd)}</td>
                    <td style={{ textAlign:'right', fontFamily:'monospace', fontWeight:600 }}>{num(d63t)}</td>
                    <td style={{ textAlign:'right', fontFamily:'monospace' }}>{num(r.d90tot)}</td>
                    <td style={{ textAlign:'right', fontFamily:'monospace' }}>{num(r.d125tot)}</td>
                  </tr>
                );
              })}

              {/* Totals row */}
              <tr style={{ background: '#f0f7ee' }}>
                <td colSpan={9} style={{ fontWeight:700, color:'#1f4e1a', textAlign:'right', fontSize:12 }}>TOTAL</td>
                <td style={{ textAlign:'right', fontWeight:700, fontFamily:'monospace' }}>{totals.d32oc}</td>
                <td style={{ textAlign:'right', fontWeight:700, fontFamily:'monospace' }}>{totals.d32b}</td>
                <td style={{ textAlign:'right', fontWeight:700, fontFamily:'monospace' }}>{totals.d32t}</td>
                <td style={{ textAlign:'right', fontWeight:700, fontFamily:'monospace' }}>{totals.d63oc}</td>
                <td style={{ textAlign:'right', fontWeight:700, fontFamily:'monospace' }}>{totals.d63b}</td>
                <td style={{ textAlign:'right', fontWeight:700, fontFamily:'monospace' }}>{totals.d63h}</td>
                <td style={{ textAlign:'right', fontWeight:700, fontFamily:'monospace' }}>{totals.d63t}</td>
                <td style={{ textAlign:'right', fontWeight:700, fontFamily:'monospace' }}>{totals.d90}</td>
                <td style={{ textAlign:'right', fontWeight:700, fontFamily:'monospace' }}>{totals.d125}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Add Laying Entry Panel ── */}
      <SlidePanel
        isOpen={panelOpen}
        onClose={() => { setPanelOpen(false); setErrors({}); }}
        title="Add PE Laying Entry"
        onSave={handleSave}
      >
        <div>
          <SectionTitle>Dates</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Laying Date" required error={errors.layDate}>
              <Input type="date" value={form.layDate} onChange={e => f('layDate', e.target.value)} error={errors.layDate} />
            </Field>
            <Field label="Testing Date">
              <Input type="date" value={form.testDate} onChange={e => f('testDate', e.target.value)} />
            </Field>
            <Field label="Charging Date">
              <Input type="date" value={form.chargeDate} onChange={e => f('chargeDate', e.target.value)} />
            </Field>
          </div>
        </div>

        <div>
          <SectionTitle>Work Details</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="RA Bill No.">
                <Input value={form.raBill} onChange={e => f('raBill', e.target.value)} />
              </Field>
              <Field label="Report No.">
                <Input value={form.reportNo} onChange={e => f('reportNo', e.target.value)} />
              </Field>
            </div>
            <Field label="Work Status" required error={errors.status}>
              <Select value={form.status} onChange={e => f('status', e.target.value)} error={errors.status}>
                {WK_STATUSES.map(s => <option key={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Area / Society" required error={errors.area}>
              <Input value={form.area} onChange={e => f('area', e.target.value)} placeholder="e.g. UE-II Block A" error={errors.area} />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Landmark">
                <Input value={form.landmark} onChange={e => f('landmark', e.target.value)} />
              </Field>
              <Field label="Coil / Batch No.">
                <Input value={form.coil} onChange={e => f('coil', e.target.value)} />
              </Field>
            </div>
            <Field label="Location">
              <Input value={form.location} onChange={e => f('location', e.target.value)} />
            </Field>
          </div>
        </div>

        <div>
          <SectionTitle>Pipe Quantities (metres)</SectionTitle>
          {/* Ø32mm */}
          <p style={{ fontSize: 11, fontWeight: 600, color: '#1f4e1a', marginBottom: 6 }}>Ø32mm</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
            <Field label="Open Cut (OC)">
              <Input type="number" min={0} value={form.d32oc} onChange={e => n('d32oc', e.target.value)} />
            </Field>
            <Field label="Boring & HDD">
              <Input type="number" min={0} value={form.d32b} onChange={e => n('d32b', e.target.value)} />
            </Field>
            <Field label="Total (auto)">
              <div style={{ height: 34, border: '1px solid #e2e8f0', borderRadius: 5, padding: '0 10px', display: 'flex', alignItems: 'center', background: '#f0f7ee', fontSize: 13, fontWeight: 700, color: '#1f4e1a' }}>
                {d32Total}
              </div>
            </Field>
          </div>

          {/* Ø63mm */}
          <p style={{ fontSize: 11, fontWeight: 600, color: '#1f4e1a', marginBottom: 6 }}>Ø63mm</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
            <Field label="OC">
              <Input type="number" min={0} value={form.d63oc} onChange={e => n('d63oc', e.target.value)} />
            </Field>
            <Field label="Boring">
              <Input type="number" min={0} value={form.d63b} onChange={e => n('d63b', e.target.value)} />
            </Field>
            <Field label="HDD">
              <Input type="number" min={0} value={form.d63hdd} onChange={e => n('d63hdd', e.target.value)} />
            </Field>
            <Field label="Total (auto)">
              <div style={{ height: 34, border: '1px solid #e2e8f0', borderRadius: 5, padding: '0 10px', display: 'flex', alignItems: 'center', background: '#f0f7ee', fontSize: 13, fontWeight: 700, color: '#1f4e1a' }}>
                {d63Total}
              </div>
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
      </SlidePanel>
    </div>
  );
}
