// src/pages/PELaying.jsx
import { useState, useMemo } from 'react';
import { useSite } from '../context/SiteContext';
import { useToast } from '../components/Toast';
import SlidePanel from '../components/SlidePanel';
import { exportPELaying } from '../utils/exportExcel';

const SITES       = ['All Sites','Khanna CA-09','UE-II Hisar','PLA Hisar','Kohara CA-07'];
const DATE_RANGES = ['All Time','Last 30 Days','Last 90 Days','Custom'];
const STATUSES    = ['All','LAYING','HDD','JOINT'];

const STATUS_CLS = { LAYING: 'badge-laying', HDD: 'badge-hdd', JOINT: 'badge-joint' };

const initialForm = {
  layDate: '',
  testDate: '',
  chargeDate: '',
  raBill: '',
  reportNo: '',
  status: '',
  area: '',
  landmark: '',
  coil: '',
  location: '',
  d32oc: 0,
  d32b: 0,
  d63oc: 0,
  d63b: 0,
  d63hdd: 0,
  d90tot: 0,
  d125tot: 0
};

function formatDateToSlash(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const year = parts[0].slice(2);
    const month = parts[1];
    const day = parts[2];
    return `${day}/${month}/${year}`;
  }
  return dateStr;
}

export default function PELaying() {
  const { peLayingList, setPeLayingList } = useSite();
  const { showToast } = useToast();

  const [site,      setSite]      = useState('All Sites');
  const [dateRange, setDateRange] = useState('All Time');
  const [raBill,    setRaBill]    = useState('');
  const [status,    setStatus]    = useState('All');

  // SlidePanel State
  const [panelOpen, setPanelOpen] = useState(false);
  const [formData, setFormData] = useState(initialForm);
  const [errors, setErrors] = useState({});

  function resetForm() {
    setFormData(initialForm);
    setErrors({});
  }

  const filtered = useMemo(() => {
    return peLayingList.filter(r => {
      if (status !== 'All' && r.status !== status) return false;
      if (raBill && !r.raBill.toLowerCase().includes(raBill.toLowerCase())) return false;
      return true;
    });
  }, [peLayingList, status, raBill]);

  /* Totals */
  const totals = useMemo(() => {
    return filtered.reduce((acc, r) => ({
      d32oc: acc.d32oc + Number(r.d32oc || 0),
      d32b:  acc.d32b  + Number(r.d32b || 0),
      d32t:  acc.d32t  + Number(r.d32oc || 0) + Number(r.d32b || 0),
      d63oc: acc.d63oc + Number(r.d63oc || 0),
      d63b:  acc.d63b  + Number(r.d63b || 0),
      d63h:  acc.d63h  + Number(r.d63hdd || 0),
      d63t:  acc.d63t  + Number(r.d63oc || 0) + Number(r.d63b || 0) + Number(r.d63hdd || 0),
      d90:   acc.d90   + Number(r.d90tot || 0),
      d125:  acc.d125  + Number(r.d125tot || 0),
    }), { d32oc:0,d32b:0,d32t:0,d63oc:0,d63b:0,d63h:0,d63t:0,d90:0,d125:0 });
  }, [filtered]);

  /* Dynamic KPI Cards */
  const kpiTotals = useMemo(() => {
    return peLayingList.reduce((acc, r) => {
      const d32 = Number(r.d32oc || 0) + Number(r.d32b || 0);
      const d63 = Number(r.d63oc || 0) + Number(r.d63b || 0) + Number(r.d63hdd || 0);
      const d90 = Number(r.d90tot || 0);
      const d125 = Number(r.d125tot || 0);
      return {
        d32: acc.d32 + d32,
        d63: acc.d63 + d63,
        d90: acc.d90 + d90,
        d125: acc.d125 + d125
      };
    }, { d32: 0, d63: 0, d90: 0, d125: 0 });
  }, [peLayingList]);

  const kpiTiles = [
    { label: 'Total Ø32mm Laid',  value: `${(1314 + kpiTotals.d32).toLocaleString()} mtr` },
    { label: 'Total Ø63mm Laid',  value: `${(3473 + kpiTotals.d63).toLocaleString()} mtr` },
    { label: 'Total Ø90mm Laid',  value: `${(1210 + kpiTotals.d90).toLocaleString()} mtr` },
    { label: 'Total Ø125mm Laid', value: `${(510 + kpiTotals.d125).toLocaleString()} mtr`   },
  ];

  function handleSave() {
    const newErrors = {};
    if (!formData.layDate) newErrors.layDate = 'Laying Date is required';
    if (!formData.status) newErrors.status = 'Work Status is required';
    if (!formData.area.trim()) newErrors.area = 'Area / Society is required';

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      showToast('⚠️ Please fill in all required fields');
      return;
    }

    const newEntry = {
      sr: peLayingList.length + 1,
      layDate: formatDateToSlash(formData.layDate),
      testDate: formatDateToSlash(formData.testDate) || '-',
      chargeDate: formatDateToSlash(formData.chargeDate) || '-',
      raBill: formData.raBill || '-',
      reportNo: formData.reportNo || '-',
      status: formData.status,
      area: formData.area,
      landmark: formData.landmark || '-',
      coil: formData.coil || '-',
      location: formData.location || '-',
      d32oc: Number(formData.d32oc || 0),
      d32b: Number(formData.d32b || 0),
      d63oc: Number(formData.d63oc || 0),
      d63b: Number(formData.d63b || 0),
      d63hdd: Number(formData.d63hdd || 0),
      d90tot: Number(formData.d90tot || 0),
      d125tot: Number(formData.d125tot || 0)
    };

    setPeLayingList([newEntry, ...peLayingList]);
    showToast('✓ Laying entry saved successfully');
    resetForm();
    setPanelOpen(false);
  }

  return (
    <div>
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1f4e1a', margin: 0 }}>PE Laying — Pipeline Progress</h1>
        <button
          onClick={() => setPanelOpen(true)}
          className="btn btn-primary"
          style={{ background: '#2d6a27', color: 'white', padding: '0 20px', height: 36, fontSize: 13, borderRadius: 6, fontWeight: 600 }}
        >
          + Add Laying Entry
        </button>
      </div>

      {/* Filter bar */}
      <div className="card section-block" style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <select className="gp-select" value={site} onChange={e => setSite(e.target.value)}>
          {SITES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="gp-select" value={dateRange} onChange={e => setDateRange(e.target.value)}>
          {DATE_RANGES.map(d => <option key={d}>{d}</option>)}
        </select>
        <input
          className="gp-input"
          placeholder="RA Bill No."
          style={{ width: 140 }}
          value={raBill}
          onChange={e => setRaBill(e.target.value)}
        />
        <select className="gp-select" value={status} onChange={e => setStatus(e.target.value)}>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <button className="btn btn-primary">Search</button>
        <button className="btn btn-outline" onClick={() => exportPELaying(filtered)} style={{ marginLeft: 'auto' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export
        </button>
      </div>

      {/* KPI Summary Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
        {kpiTiles.map(k => (
          <div key={k.label} className="kpi-tile" style={{ background: '#2d6a27' }}>
            <p className="kpi-label">{k.label}</p>
            <p className="kpi-value" style={{ fontSize: 22 }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="gp-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>Sr.</th>
                <th>Laying Date</th>
                <th>Testing Date</th>
                <th>Charging Date</th>
                <th>RA Bill No.</th>
                <th>Report No.</th>
                <th>Status</th>
                <th>Area/Society</th>
                <th>Coil/Batch No.</th>
                <th style={{ textAlign: 'right' }}>Ø32 OC</th>
                <th style={{ textAlign: 'right' }}>Ø32 Boring</th>
                <th style={{ textAlign: 'right' }}>Ø32 Total</th>
                <th style={{ textAlign: 'right' }}>Ø63 OC</th>
                <th style={{ textAlign: 'right' }}>Ø63 Boring</th>
                <th style={{ textAlign: 'right' }}>Ø63 HDD</th>
                <th style={{ textAlign: 'right' }}>Ø63 Total</th>
                <th style={{ textAlign: 'right' }}>Ø90 Total</th>
                <th style={{ textAlign: 'right' }}>Ø125 Total</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const d32t = r.d32oc + r.d32b;
                const d63t = r.d63oc + r.d63b + r.d63hdd;
                const num  = v => v > 0 ? v : <span style={{ color: '#cbd5e1' }}>—</span>;
                return (
                  <tr key={r.sr}>
                    <td style={{ textAlign: 'center', color: '#94a3b8' }}>{r.sr}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.layDate}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.testDate}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.chargeDate}</td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 11 }}>{r.raBill}</td>
                    <td style={{ textAlign: 'center' }}>{r.reportNo}</td>
                    <td><span className={`badge ${STATUS_CLS[r.status]}`}>{r.status}</span></td>
                    <td style={{ whiteSpace: 'nowrap' }}>{r.area}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.coil}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{num(r.d32oc)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{num(r.d32b)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{num(d32t)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{num(r.d63oc)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{num(r.d63b)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{num(r.d63hdd)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{num(d63t)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{num(r.d90tot)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{num(r.d125tot)}</td>
                  </tr>
                );
              })}

              {/* Totals row */}
              <tr style={{ background: '#f0f7ee' }}>
                <td colSpan={9} style={{ fontWeight: 700, color: '#1f4e1a', textAlign: 'right', fontSize: 12 }}>TOTAL</td>
                <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{totals.d32oc}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{totals.d32b}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{totals.d32t}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{totals.d63oc}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{totals.d63b}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{totals.d63h}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{totals.d63t}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{totals.d90}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{totals.d125}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── SlidePanel for PE Laying Entry ── */}
      <SlidePanel
        isOpen={panelOpen}
        onClose={() => { resetForm(); setPanelOpen(false); }}
        title="Add PE Laying Entry"
      >
        <div>
          <div className="panel-section-title">Laying details</div>
          <div className="panel-field">
            <label className="panel-label">Laying Date*</label>
            <input
              type="date"
              className={`panel-input${errors.layDate ? ' error' : ''}`}
              value={formData.layDate}
              onChange={e => setFormData({ ...formData, layDate: e.target.value })}
            />
            {errors.layDate && <p className="panel-error-text">{errors.layDate}</p>}
          </div>

          <div className="panel-field">
            <label className="panel-label">Testing Date</label>
            <input
              type="date"
              className="panel-input"
              value={formData.testDate}
              onChange={e => setFormData({ ...formData, testDate: e.target.value })}
            />
          </div>

          <div className="panel-field">
            <label className="panel-label">Charging Date</label>
            <input
              type="date"
              className="panel-input"
              value={formData.chargeDate}
              onChange={e => setFormData({ ...formData, chargeDate: e.target.value })}
            />
          </div>

          <div className="panel-field">
            <label className="panel-label">RA Bill No.</label>
            <input
              type="text"
              className="panel-input"
              placeholder="e.g. RA Bill No.1"
              value={formData.raBill}
              onChange={e => setFormData({ ...formData, raBill: e.target.value })}
            />
          </div>

          <div className="panel-field">
            <label className="panel-label">Report No.</label>
            <input
              type="text"
              className="panel-input"
              placeholder="e.g. 1"
              value={formData.reportNo}
              onChange={e => setFormData({ ...formData, reportNo: e.target.value })}
            />
          </div>

          <div className="panel-field">
            <label className="panel-label">Work Status*</label>
            <select
              className={`panel-select${errors.status ? ' error' : ''}`}
              value={formData.status}
              onChange={e => setFormData({ ...formData, status: e.target.value })}
            >
              <option value="">Select Status</option>
              {['LAYING', 'HDD', 'JOINT'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {errors.status && <p className="panel-error-text">{errors.status}</p>}
          </div>
        </div>

        <div>
          <div className="panel-section-title">Location & batch information</div>
          <div className="panel-field">
            <label className="panel-label">Area / Society*</label>
            <input
              type="text"
              className={`panel-input${errors.area ? ' error' : ''}`}
              placeholder="e.g. Kishangar Village"
              value={formData.area}
              onChange={e => setFormData({ ...formData, area: e.target.value })}
            />
            {errors.area && <p className="panel-error-text">{errors.area}</p>}
          </div>

          <div className="panel-field">
            <label className="panel-label">Landmark</label>
            <input
              type="text"
              className="panel-input"
              placeholder="Landmark"
              value={formData.landmark}
              onChange={e => setFormData({ ...formData, landmark: e.target.value })}
            />
          </div>

          <div className="panel-field">
            <label className="panel-label">Coil / Batch No.</label>
            <input
              type="text"
              className="panel-input"
              placeholder="e.g. 96-2220607041"
              value={formData.coil}
              onChange={e => setFormData({ ...formData, coil: e.target.value })}
            />
          </div>

          <div className="panel-field">
            <label className="panel-label">Location</label>
            <input
              type="text"
              className="panel-input"
              placeholder="Location details"
              value={formData.location}
              onChange={e => setFormData({ ...formData, location: e.target.value })}
            />
          </div>
        </div>

        <div>
          <div className="panel-section-title">Quantities (mtr)</div>
          
          {/* Ø32mm Pipe */}
          <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, marginBottom: 14, border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#1f4e1a', display: 'block', marginBottom: 8 }}>Ø32mm Pipe</span>
            <div className="panel-field" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <label className="panel-label" style={{ margin: 0 }}>Open Cut</label>
              <input
                type="number"
                className="panel-input"
                style={{ width: 120 }}
                min={0}
                value={formData.d32oc}
                onChange={e => setFormData({ ...formData, d32oc: Number(e.target.value) })}
              />
            </div>
            <div className="panel-field" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <label className="panel-label" style={{ margin: 0 }}>Boring & HDD</label>
              <input
                type="number"
                className="panel-input"
                style={{ width: 120 }}
                min={0}
                value={formData.d32b}
                onChange={e => setFormData({ ...formData, d32b: Number(e.target.value) })}
              />
            </div>
            <div className="panel-field" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 0 }}>
              <label className="panel-label" style={{ margin: 0, color: '#16a34a', fontWeight: 700 }}>Total (Auto)</label>
              <input
                type="number"
                className="panel-input"
                style={{ width: 120, borderColor: '#16a34a', color: '#16a34a', fontWeight: 600, background: '#f0fdf4' }}
                value={formData.d32oc + formData.d32b}
                readOnly
              />
            </div>
          </div>

          {/* Ø63mm Pipe */}
          <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, marginBottom: 14, border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#1f4e1a', display: 'block', marginBottom: 8 }}>Ø63mm Pipe</span>
            <div className="panel-field" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <label className="panel-label" style={{ margin: 0 }}>Open Cut</label>
              <input
                type="number"
                className="panel-input"
                style={{ width: 120 }}
                min={0}
                value={formData.d63oc}
                onChange={e => setFormData({ ...formData, d63oc: Number(e.target.value) })}
              />
            </div>
            <div className="panel-field" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <label className="panel-label" style={{ margin: 0 }}>Boring</label>
              <input
                type="number"
                className="panel-input"
                style={{ width: 120 }}
                min={0}
                value={formData.d63b}
                onChange={e => setFormData({ ...formData, d63b: Number(e.target.value) })}
              />
            </div>
            <div className="panel-field" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <label className="panel-label" style={{ margin: 0 }}>HDD</label>
              <input
                type="number"
                className="panel-input"
                style={{ width: 120 }}
                min={0}
                value={formData.d63hdd}
                onChange={e => setFormData({ ...formData, d63hdd: Number(e.target.value) })}
              />
            </div>
            <div className="panel-field" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 0 }}>
              <label className="panel-label" style={{ margin: 0, color: '#16a34a', fontWeight: 700 }}>Total (Auto)</label>
              <input
                type="number"
                className="panel-input"
                style={{ width: 120, borderColor: '#16a34a', color: '#16a34a', fontWeight: 600, background: '#f0fdf4' }}
                value={formData.d63oc + formData.d63b + formData.d63hdd}
                readOnly
              />
            </div>
          </div>

          {/* Ø90mm & Ø125mm Pipes */}
          <div className="panel-field" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <label className="panel-label" style={{ margin: 0 }}>Ø90mm — Total</label>
            <input
              type="number"
              className="panel-input"
              style={{ width: 120 }}
              min={0}
              value={formData.d90tot}
              onChange={e => setFormData({ ...formData, d90tot: Number(e.target.value) })}
            />
          </div>

          <div className="panel-field" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <label className="panel-label" style={{ margin: 0 }}>Ø125mm — Total</label>
            <input
              type="number"
              className="panel-input"
              style={{ width: 120 }}
              min={0}
              value={formData.d125tot}
              onChange={e => setFormData({ ...formData, d125tot: Number(e.target.value) })}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="panel-footer" style={{ margin: '0 -20px -20px', padding: '14px 20px' }}>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>* Required fields</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { resetForm(); setPanelOpen(false); }} className="panel-btn-cancel">Cancel</button>
            <button onClick={handleSave} className="panel-btn-save">Save Entry</button>
          </div>
        </div>
      </SlidePanel>
    </div>
  );
}
