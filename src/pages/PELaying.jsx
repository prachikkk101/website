// src/pages/PELaying.jsx
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSite, useSelectedSiteId } from '../context/SiteContext';
import { useToast } from '../components/Toast';
import SlidePanel from '../components/SlidePanel';
import { peLayingService } from '../api/peLayingService';
import { exportPELaying } from '../utils/exportExcel';
import { getPELaying, addPELaying } from '../utils/dataService';

const DATE_RANGES = ['All Time', 'Last 30 Days', 'Last 90 Days'];
const STATUSES    = ['All', 'LAYING', 'HDD', 'JOINT'];
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

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(2);
  return `${day}/${month}/${year}`;
}

export default function PELaying() {
  const { selectedSite, sites } = useSite();
  const { showToast } = useToast();

  const [peLayingList, setPeLayingList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [dateRange, setDateRange] = useState('All Time');
  const [raBill,    setRaBill]    = useState('');
  const [status,    setStatus]    = useState('All');

  // Export date range
  const todayStr = new Date().toISOString().split('T')[0];
  const [exportFromDate, setExportFromDate] = useState(todayStr);
  const [exportToDate, setExportToDate] = useState(todayStr);
  const exportDateError = exportFromDate > exportToDate;

  // SlidePanel State
  const [panelOpen, setPanelOpen] = useState(false);
  const [formData, setFormData] = useState(initialForm);
  const [errors, setErrors] = useState({});

  // Get active site ID
  const activeSiteId = useSelectedSiteId() || (sites.length > 0 ? sites[0].id : null);

  const fetchPELaying = useCallback(async () => {
    const isLocalMode = !activeSiteId || String(activeSiteId).startsWith('local-site-');
    if (isLocalMode) {
      setPeLayingList(getPELaying());
      return;
    }
    setLoading(true);
    try {
      const data = await peLayingService.getPELaying(activeSiteId);
      const records = data.records || data || [];
      setPeLayingList(Array.isArray(records) && records.length > 0 ? records : getPELaying());
    } catch {
      setPeLayingList(getPELaying());
    } finally {
      setLoading(false);
    }
  }, [activeSiteId]);

  useEffect(() => {
    fetchPELaying();
  }, [fetchPELaying]);

  function resetForm() {
    setFormData(initialForm);
    setErrors({});
  }

  const filtered = useMemo(() => {
    return peLayingList.filter(r => {
      if (status !== 'All' && r.status !== status) return false;
      const rBill = r.raBillNo || r.raBill || '';
      if (raBill && !rBill.toLowerCase().includes(raBill.toLowerCase())) return false;

      // Date range filtering
      if (dateRange !== 'All Time') {
        const date = new Date(r.layingDate);
        const now = new Date();
        if (dateRange === 'Last 30 Days') {
          const limit = new Date(now.setDate(now.getDate() - 30));
          if (date < limit) return false;
        } else if (dateRange === 'Last 90 Days') {
          const limit = new Date(now.setDate(now.getDate() - 90));
          if (date < limit) return false;
        }
      }
      return true;
    });
  }, [peLayingList, status, raBill, dateRange]);

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
    }), { d32oc: 0, d32b: 0, d32t: 0, d63oc: 0, d63b: 0, d63h: 0, d63t: 0, d90: 0, d125: 0 });
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

  async function handleSave() {
    if (!activeSiteId) {
      showToast('⚠️ No site selected');
      return;
    }

    const newErrors = {};
    if (!formData.layDate) newErrors.layDate = 'Laying Date is required';
    if (!formData.status) newErrors.status = 'Work Status is required';
    if (!formData.area.trim()) newErrors.area = 'Area / Society is required';

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      showToast('⚠️ Please fill in all required fields');
      return;
    }

    const payload = {
      layingDate: formData.layDate,
      testingDate: formData.testDate || undefined,
      chargingDate: formData.chargeDate || undefined,
      raBillNo: formData.raBill || undefined,
      reportNo: formData.reportNo || undefined,
      status: formData.status,
      area: formData.area,
      coilNo: formData.coil || 'N/A',
      d32oc: Number(formData.d32oc || 0),
      d32b: Number(formData.d32b || 0),
      d63oc: Number(formData.d63oc || 0),
      d63b: Number(formData.d63b || 0),
      d63hdd: Number(formData.d63hdd || 0),
      d90tot: Number(formData.d90tot || 0),
      d125tot: Number(formData.d125tot || 0)
    };

    setSaving(true);
    try {
      await peLayingService.createPELaying(activeSiteId, payload);
    } catch {
      // API offline — persist locally
      addPELaying({ ...payload, layDate: payload.layingDate, raBill: payload.raBillNo, coil: payload.coilNo });
    }
    showToast('✓ Laying entry saved successfully');
    resetForm();
    setPanelOpen(false);
    fetchPELaying();
    setSaving(false);
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
        <button className="btn btn-primary" onClick={fetchPELaying}>Search</button>
      </div>

      {/* Export with date range */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>Export entries from</span>
          <input
            type="date"
            value={exportFromDate}
            onChange={e => setExportFromDate(e.target.value)}
            style={{ height: 32, border: '1px solid #d1d5db', borderRadius: 4, padding: '0 8px', fontSize: 12 }}
          />
          <span style={{ fontSize: 12, color: '#64748b' }}>to</span>
          <input
            type="date"
            value={exportToDate}
            onChange={e => setExportToDate(e.target.value)}
            style={{ height: 32, border: '1px solid #d1d5db', borderRadius: 4, padding: '0 8px', fontSize: 12 }}
          />
          <button
            disabled={exportDateError}
            onClick={() => exportPELaying(filtered, exportFromDate, exportToDate)}
            style={{
              height: 32, background: exportDateError ? '#94a3b8' : '#2d6a27', color: 'white',
              border: 'none', borderRadius: 4, padding: '0 14px', fontSize: 12,
              fontWeight: 600, cursor: exportDateError ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            ↓ Export Excel
          </button>
        </div>
        {exportDateError && (
          <span style={{ fontSize: 11, color: '#dc2626', width: '100%', textAlign: 'right' }}>From date cannot be after To date</span>
        )}
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
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>Loading records...</div>
        ) : (
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
                {filtered.map((r, i) => {
                  const d32t = Number(r.d32oc || 0) + Number(r.d32b || 0);
                  const d63t = Number(r.d63oc || 0) + Number(r.d63b || 0) + Number(r.d63hdd || 0);
                  const num  = v => Number(v) > 0 ? Number(v) : <span style={{ color: '#cbd5e1' }}>—</span>;
                  return (
                    <tr key={r.id || i}>
                      <td style={{ textAlign: 'center', color: '#94a3b8' }}>{i + 1}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{formatDate(r.layingDate)}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{formatDate(r.testingDate)}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{formatDate(r.chargingDate)}</td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: 11 }}>{r.raBillNo || '—'}</td>
                      <td style={{ textAlign: 'center' }}>{r.reportNo || '—'}</td>
                      <td><span className={`badge ${STATUS_CLS[r.status]}`}>{r.status}</span></td>
                      <td style={{ whiteSpace: 'nowrap' }}>{r.area}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.coilNo || '—'}</td>
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

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={18} style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
                      No records found.
                    </td>
                  </tr>
                )}

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
        )}
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
            <label className="panel-label">Coil / Batch No.</label>
            <input
              type="text"
              className="panel-input"
              placeholder="e.g. 96-2220607041"
              value={formData.coil}
              onChange={e => setFormData({ ...formData, coil: e.target.value })}
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
                value={Number(formData.d32oc || 0) + Number(formData.d32b || 0)}
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
                value={Number(formData.d63oc || 0) + Number(formData.d63b || 0) + Number(formData.d63hdd || 0)}
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
            <button onClick={handleSave} disabled={saving} className="panel-btn-save">
              {saving ? 'Saving...' : 'Save Entry'}
            </button>
          </div>
        </div>
      </SlidePanel>
    </div>
  );
}
