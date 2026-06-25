// src/pages/ICWork.jsx
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSite, useSelectedSiteId } from '../context/SiteContext';
import { useToast } from '../components/Toast';
import SlidePanel from '../components/SlidePanel';
import { icLmcService } from '../api/icLmcService';
import { exportLMCData, exportICData } from '../utils/exportExcel';

const STATUSES = ['All', 'Done', 'Pending'];

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(2);
  return `${day}/${month}/${year}`;
}

const initialLMCForm = {
  appNo: '',
  bpNo: '',
  customerName: '',
  address: '',
  lmcDate: '',
  regulatorNo: '',
  meterSerialNo: '',
  remarks: 'PENDING'
};

const initialICForm = {
  customerName: '',
  address: '',
  icDate: '',
  regulatorPoutMbar: 0,
  flowRateScmh: 0,
  regulatorNo: '',
  meterSerialNo: '',
  status: 'Pending'
};

export default function ICWork() {
  const { selectedSite, sites } = useSite();
  const { showToast } = useToast();

  const [activeSubTab, setActiveSubTab] = useState('lmc'); // 'lmc' | 'ic'

  // Data States
  const [lmcList, setLmcList] = useState([]);
  const [icList, setIcList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Search Filters
  const [lmcSearch, setLmcSearch] = useState('');
  const [icSearch, setIcSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // SlidePanel States
  const [lmcPanelOpen, setLmcPanelOpen] = useState(false);
  const [icPanelOpen, setIcPanelOpen] = useState(false);
  const [lmcFormData, setLmcFormData] = useState(initialLMCForm);
  const [icFormData, setIcFormData] = useState(initialICForm);
  const [errors, setErrors] = useState({});

  // Active site
  const activeSiteId = useSelectedSiteId() || (sites.length > 0 ? sites[0].id : null);

  const fetchLMC = useCallback(async () => {
    if (!activeSiteId) return;
    setLoading(true);
    try {
      const data = await icLmcService.getLMCWork(activeSiteId);
      const records = data.records || data || [];
      setLmcList(Array.isArray(records) ? records : []);
    } catch (err) {
      console.error('Failed to fetch LMC work:', err);
      setLmcList([]);
    } finally {
      setLoading(false);
    }
  }, [activeSiteId]);

  const fetchIC = useCallback(async () => {
    if (!activeSiteId) return;
    setLoading(true);
    try {
      const data = await icLmcService.getICWork(activeSiteId);
      const records = data.records || data || [];
      setIcList(Array.isArray(records) ? records : []);
    } catch (err) {
      console.error('Failed to fetch IC work:', err);
      setIcList([]);
    } finally {
      setLoading(false);
    }
  }, [activeSiteId]);

  useEffect(() => {
    if (activeSubTab === 'lmc') {
      fetchLMC();
    } else {
      fetchIC();
    }
  }, [activeSubTab, fetchLMC, fetchIC]);

  // Filtering data
  const filteredLMC = useMemo(() => {
    return lmcList.filter((r) => {
      const query = lmcSearch.toLowerCase();
      const app = r.appNo || '';
      const bp = r.bpNo || '';
      const name = r.customerName || '';
      if (lmcSearch && !app.toLowerCase().includes(query) && !bp.toLowerCase().includes(query) && !name.toLowerCase().includes(query)) {
        return false;
      }
      return true;
    });
  }, [lmcList, lmcSearch]);

  const filteredIC = useMemo(() => {
    return icList.filter((r) => {
      if (statusFilter !== 'All' && r.status !== statusFilter) return false;
      const query = icSearch.toLowerCase();
      const name = r.customerName || '';
      const addr = r.address || '';
      if (icSearch && !name.toLowerCase().includes(query) && !addr.toLowerCase().includes(query)) {
        return false;
      }
      return true;
    });
  }, [icList, icSearch, statusFilter]);

  // KPI Calculations
  const lmcKPIs = useMemo(() => {
    const done = lmcList.filter((r) => r.remarks?.toUpperCase() === 'DONE').length;
    const pending = lmcList.length - done;
    return { done, pending };
  }, [lmcList]);

  const icKPIs = useMemo(() => {
    const done = icList.filter((r) => r.status === 'Done').length;
    const pending = icList.length - done;
    return { done, pending };
  }, [icList]);

  // Actions
  async function handleAddLMC() {
    const newErrors = {};
    if (!lmcFormData.appNo.trim()) newErrors.appNo = 'Application No. is required';
    if (!lmcFormData.customerName.trim()) newErrors.customerName = 'Customer Name is required';
    if (!lmcFormData.address.trim()) newErrors.address = 'Address is required';

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      showToast('⚠️ Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      await icLmcService.createLMCWork(activeSiteId, {
        appNo: lmcFormData.appNo,
        bpNo: lmcFormData.bpNo || undefined,
        customerName: lmcFormData.customerName,
        address: lmcFormData.address,
        lmcDate: lmcFormData.lmcDate || undefined,
        regulatorNo: lmcFormData.regulatorNo || undefined,
        meterSerialNo: lmcFormData.meterSerialNo || undefined,
        remarks: lmcFormData.remarks
      });
      showToast('✓ LMC connection added successfully');
      setLmcFormData(initialLMCForm);
      setLmcPanelOpen(false);
      fetchLMC();
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to add connection';
      showToast(`⚠️ ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddIC() {
    const newErrors = {};
    if (!icFormData.customerName.trim()) newErrors.customerName = 'Customer/Site Name is required';
    if (!icFormData.address.trim()) newErrors.address = 'Address is required';

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      showToast('⚠️ Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      await icLmcService.createICWork(activeSiteId, {
        customerName: icFormData.customerName,
        address: icFormData.address,
        icDate: icFormData.icDate || undefined,
        regulatorPoutMbar: Number(icFormData.regulatorPoutMbar || 0),
        flowRateScmh: Number(icFormData.flowRateScmh || 0),
        regulatorNo: icFormData.regulatorNo || undefined,
        meterSerialNo: icFormData.meterSerialNo || undefined,
        status: icFormData.status
      });
      showToast('✓ I&C entry added successfully');
      setIcFormData(initialICForm);
      setIcPanelOpen(false);
      fetchIC();
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to add entry';
      showToast(`⚠️ ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  async function toggleLMCStatus(record) {
    const newRemarks = record.remarks?.toUpperCase() === 'DONE' ? 'PENDING' : 'DONE';
    try {
      await icLmcService.updateLMCWork(activeSiteId, record.id, { remarks: newRemarks });
      showToast(`✓ LMC status updated to ${newRemarks}`);
      fetchLMC();
    } catch (err) {
      showToast(`⚠️ Failed to update status: ${err.message}`);
    }
  }

  async function toggleICStatus(record) {
    const newStatus = record.status === 'Done' ? 'Pending' : 'Done';
    try {
      await icLmcService.updateICWork(activeSiteId, record.id, { status: newStatus });
      showToast(`✓ I&C status updated to ${newStatus}`);
      fetchIC();
    } catch (err) {
      showToast(`⚠️ Failed to update status: ${err.message}`);
    }
  }

  return (
    <div>
      {/* Tab Selectors */}
      <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: 16 }}>
        <button
          onClick={() => { setActiveSubTab('lmc'); setStatusFilter('All'); }}
          style={{
            padding: '10px 20px',
            fontSize: 15,
            fontWeight: 700,
            color: activeSubTab === 'lmc' ? '#1f4e1a' : '#64748b',
            borderBottom: activeSubTab === 'lmc' ? '3px solid #2d6a27' : 'none',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s'
          }}
        >
          LMC Connections (Last Mile)
        </button>
        <button
          onClick={() => { setActiveSubTab('ic'); setStatusFilter('All'); }}
          style={{
            padding: '10px 20px',
            fontSize: 15,
            fontWeight: 700,
            color: activeSubTab === 'ic' ? '#1f4e1a' : '#64748b',
            borderBottom: activeSubTab === 'ic' ? '3px solid #2d6a27' : 'none',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s'
          }}
        >
          I&C Commissioning (Industrial / Commercial)
        </button>
      </div>

      {activeSubTab === 'lmc' ? (
        /* ════════════════ LMC SUB-TAB ════════════════ */
        <div>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1f4e1a', margin: 0 }}>LMC Work Tracking</h2>
            <button
              onClick={() => setLmcPanelOpen(true)}
              className="btn btn-primary"
              style={{ background: '#2d6a27', color: 'white', padding: '0 20px', height: 36, fontSize: 13, borderRadius: 6, fontWeight: 600 }}
            >
              + Add LMC Connection
            </button>
          </div>

          {/* KPI Tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16, maxWidth: 400 }}>
            <div className="kpi-tile" style={{ background: '#2d6a27' }}>
              <p className="kpi-label">LMC Done</p>
              <p className="kpi-value">{lmcKPIs.done}</p>
            </div>
            <div className="kpi-tile" style={{ background: '#c0440a' }}>
              <p className="kpi-label">LMC Pending</p>
              <p className="kpi-value">{lmcKPIs.pending}</p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="card section-block" style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <input
              className="gp-input"
              placeholder="Search App/BP No/Name..."
              style={{ width: 240 }}
              value={lmcSearch}
              onChange={(e) => setLmcSearch(e.target.value)}
            />
            <button className="btn btn-primary" onClick={fetchLMC}>Search</button>
            <button className="btn btn-outline" onClick={() => exportLMCData(filteredLMC)} style={{ marginLeft: 'auto' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export
            </button>
          </div>

          {/* LMC Table */}
          <div className="card" style={{ overflow: 'hidden' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>Loading records...</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="gp-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>Sr.</th>
                      <th>Application No.</th>
                      <th>BP Number</th>
                      <th style={{ minWidth: 160 }}>Customer Name</th>
                      <th style={{ minWidth: 200 }}>Address</th>
                      <th>LMC Date</th>
                      <th>Regulator No.</th>
                      <th>Meter Serial No.</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLMC.map((r, i) => (
                      <tr key={r.id || i}>
                        <td style={{ textAlign: 'center', color: '#94a3b8' }}>{i + 1}</td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{r.appNo}</td>
                        <td style={{ fontFamily: 'monospace' }}>{r.bpNo || '—'}</td>
                        <td>{r.customerName}</td>
                        <td style={{ fontSize: 11.5, color: '#64748b' }}>{r.address}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{formatDate(r.lmcDate)}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.regulatorNo || '—'}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.meterSerialNo || '—'}</td>
                        <td>
                          <span className={`badge ${r.remarks?.toUpperCase() === 'DONE' ? 'badge-done' : 'badge-updated'}`}>
                            {r.remarks || 'PENDING'}
                          </span>
                        </td>
                        <td>
                          <button
                            onClick={() => toggleLMCStatus(r)}
                            className="btn btn-outline"
                            style={{ padding: '2px 8px', fontSize: 11, height: 24 }}
                          >
                            Toggle Status
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredLMC.length === 0 && (
                      <tr>
                        <td colSpan={10} style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
                          No LMC connections found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ════════════════ I&C SUB-TAB ════════════════ */
        <div>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1f4e1a', margin: 0 }}>Industrial & Commercial (I&C) Commissioning</h2>
            <button
              onClick={() => setIcPanelOpen(true)}
              className="btn btn-primary"
              style={{ background: '#2d6a27', color: 'white', padding: '0 20px', height: 36, fontSize: 13, borderRadius: 6, fontWeight: 600 }}
            >
              + Add I&C Commissioning
            </button>
          </div>

          {/* KPI Tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16, maxWidth: 400 }}>
            <div className="kpi-tile" style={{ background: '#2d6a27' }}>
              <p className="kpi-label">I&C Done</p>
              <p className="kpi-value">{icKPIs.done}</p>
            </div>
            <div className="kpi-tile" style={{ background: '#c0440a' }}>
              <p className="kpi-label">I&C Pending</p>
              <p className="kpi-value">{icKPIs.pending}</p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="card section-block" style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <input
              className="gp-input"
              placeholder="Search Customer/Address..."
              style={{ width: 220 }}
              value={icSearch}
              onChange={(e) => setIcSearch(e.target.value)}
            />
            <select className="gp-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button className="btn btn-primary" onClick={fetchIC}>Search</button>
            <button className="btn btn-outline" onClick={() => exportICData(filteredIC)} style={{ marginLeft: 'auto' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export
            </button>
          </div>

          {/* I&C Table */}
          <div className="card" style={{ overflow: 'hidden' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>Loading records...</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="gp-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>Sr.</th>
                      <th style={{ minWidth: 180 }}>Customer / Site Name</th>
                      <th style={{ minWidth: 200 }}>Address</th>
                      <th>I&C Date</th>
                      <th>Service Reg. No.</th>
                      <th>Meter Serial No.</th>
                      <th style={{ textAlign: 'right' }}>Pressure (mbar)</th>
                      <th style={{ textAlign: 'right' }}>Flow Rate (SCMH)</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIC.map((r, i) => (
                      <tr key={r.id || i}>
                        <td style={{ textAlign: 'center', color: '#94a3b8' }}>{i + 1}</td>
                        <td style={{ fontWeight: 600 }}>{r.customerName}</td>
                        <td style={{ fontSize: 11.5, color: '#64748b' }}>{r.address}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{formatDate(r.icDate)}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.regulatorNo || '—'}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.meterSerialNo || '—'}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{Number(r.regulatorPoutMbar)}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{Number(r.flowRateScmh)}</td>
                        <td>
                          <span className={`badge ${r.status === 'Done' ? 'badge-done' : 'badge-updated'}`}>
                            {r.status}
                          </span>
                        </td>
                        <td>
                          <button
                            onClick={() => toggleICStatus(r)}
                            className="btn btn-outline"
                            style={{ padding: '2px 8px', fontSize: 11, height: 24 }}
                          >
                            Toggle Status
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredIC.length === 0 && (
                      <tr>
                        <td colSpan={10} style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
                          No I&C entries found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SlidePanel for Adding LMC Entry ── */}
      <SlidePanel
        isOpen={lmcPanelOpen}
        onClose={() => { setLmcFormData(initialLMCForm); setErrors({}); setLmcPanelOpen(false); }}
        title="Add LMC Connection"
      >
        <div className="panel-section-title">Application Info</div>
        <div className="panel-field">
          <label className="panel-label">Application No.*</label>
          <input
            type="text"
            className={`panel-input${errors.appNo ? ' error' : ''}`}
            placeholder="e.g. 110910001360"
            value={lmcFormData.appNo}
            onChange={(e) => setLmcFormData({ ...lmcFormData, appNo: e.target.value })}
          />
          {errors.appNo && <p className="panel-error-text">{errors.appNo}</p>}
        </div>

        <div className="panel-field">
          <label className="panel-label">BP Number</label>
          <input
            type="text"
            className="panel-input"
            placeholder="e.g. 1700053531"
            value={lmcFormData.bpNo}
            onChange={(e) => setLmcFormData({ ...lmcFormData, bpNo: e.target.value })}
          />
        </div>

        <div className="panel-field">
          <label className="panel-label">Customer Name*</label>
          <input
            type="text"
            className={`panel-input${errors.customerName ? ' error' : ''}`}
            placeholder="Customer Name"
            value={lmcFormData.customerName}
            onChange={(e) => setLmcFormData({ ...lmcFormData, customerName: e.target.value })}
          />
          {errors.customerName && <p className="panel-error-text">{errors.customerName}</p>}
        </div>

        <div className="panel-field">
          <label className="panel-label">Address*</label>
          <input
            type="text"
            className={`panel-input${errors.address ? ' error' : ''}`}
            placeholder="Address details"
            value={lmcFormData.address}
            onChange={(e) => setLmcFormData({ ...lmcFormData, address: e.target.value })}
          />
          {errors.address && <p className="panel-error-text">{errors.address}</p>}
        </div>

        <div className="panel-section-title">Work & Status Details</div>
        <div className="panel-field">
          <label className="panel-label">LMC Installation Date</label>
          <input
            type="date"
            className="panel-input"
            value={lmcFormData.lmcDate}
            onChange={(e) => setLmcFormData({ ...lmcFormData, lmcDate: e.target.value })}
          />
        </div>

        <div className="panel-field">
          <label className="panel-label">Regulator Number</label>
          <input
            type="text"
            className="panel-input"
            placeholder="Service Regulator No."
            value={lmcFormData.regulatorNo}
            onChange={(e) => setLmcFormData({ ...lmcFormData, regulatorNo: e.target.value })}
          />
        </div>

        <div className="panel-field">
          <label className="panel-label">Meter Serial No.</label>
          <input
            type="text"
            className="panel-input"
            placeholder="Meter Serial No."
            value={lmcFormData.meterSerialNo}
            onChange={(e) => setLmcFormData({ ...lmcFormData, meterSerialNo: e.target.value })}
          />
        </div>

        <div className="panel-field">
          <label className="panel-label">Remarks / Status</label>
          <select
            className="panel-select"
            value={lmcFormData.remarks}
            onChange={(e) => setLmcFormData({ ...lmcFormData, remarks: e.target.value })}
          >
            <option value="PENDING">PENDING</option>
            <option value="DONE">DONE</option>
          </select>
        </div>

        {/* Footer */}
        <div className="panel-footer" style={{ margin: '0 -20px -20px', padding: '14px 20px' }}>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>* Required fields</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setLmcFormData(initialLMCForm); setErrors({}); setLmcPanelOpen(false); }} className="panel-btn-cancel">Cancel</button>
            <button onClick={handleAddLMC} disabled={saving} className="panel-btn-save">
              {saving ? 'Saving...' : 'Save LMC'}
            </button>
          </div>
        </div>
      </SlidePanel>

      {/* ── SlidePanel for Adding I&C Entry ── */}
      <SlidePanel
        isOpen={icPanelOpen}
        onClose={() => { setIcFormData(initialICForm); setErrors({}); setIcPanelOpen(false); }}
        title="Add I&C Commissioning"
      >
        <div className="panel-section-title">Site details</div>
        <div className="panel-field">
          <label className="panel-label">Customer / Site Name*</label>
          <input
            type="text"
            className={`panel-input${errors.customerName ? ' error' : ''}`}
            placeholder="e.g. Elegance Banquet & Restaurant"
            value={icFormData.customerName}
            onChange={(e) => setIcFormData({ ...icFormData, customerName: e.target.value })}
          />
          {errors.customerName && <p className="panel-error-text">{errors.customerName}</p>}
        </div>

        <div className="panel-field">
          <label className="panel-label">Address*</label>
          <input
            type="text"
            className={`panel-input${errors.address ? ' error' : ''}`}
            placeholder="Address details"
            value={icFormData.address}
            onChange={(e) => setIcFormData({ ...icFormData, address: e.target.value })}
          />
          {errors.address && <p className="panel-error-text">{errors.address}</p>}
        </div>

        <div className="panel-section-title">Technical Specifications</div>
        <div className="panel-field">
          <label className="panel-label">Commissioning Date</label>
          <input
            type="date"
            className="panel-input"
            value={icFormData.icDate}
            onChange={(e) => setIcFormData({ ...icFormData, icDate: e.target.value })}
          />
        </div>

        <div className="panel-field">
          <label className="panel-label">Regulator Outlet Pressure (mbar)</label>
          <input
            type="number"
            className="panel-input"
            placeholder="e.g. 300"
            value={icFormData.regulatorPoutMbar}
            onChange={(e) => setIcFormData({ ...icFormData, regulatorPoutMbar: Number(e.target.value) })}
          />
        </div>

        <div className="panel-field">
          <label className="panel-label">Flow Rate (SCMH)</label>
          <input
            type="number"
            className="panel-input"
            placeholder="e.g. 25"
            value={icFormData.flowRateScmh}
            onChange={(e) => setIcFormData({ ...icFormData, flowRateScmh: Number(e.target.value) })}
          />
        </div>

        <div className="panel-field">
          <label className="panel-label">Regulator Number</label>
          <input
            type="text"
            className="panel-input"
            placeholder="Regulator No."
            value={icFormData.regulatorNo}
            onChange={(e) => setIcFormData({ ...icFormData, regulatorNo: e.target.value })}
          />
        </div>

        <div className="panel-field">
          <label className="panel-label">Meter Serial No.</label>
          <input
            type="text"
            className="panel-input"
            placeholder="Meter Serial No."
            value={icFormData.meterSerialNo}
            onChange={(e) => setIcFormData({ ...icFormData, meterSerialNo: e.target.value })}
          />
        </div>

        <div className="panel-field">
          <label className="panel-label">Commissioning Status</label>
          <select
            className="panel-select"
            value={icFormData.status}
            onChange={(e) => setIcFormData({ ...icFormData, status: e.target.value })}
          >
            <option value="Pending">Pending</option>
            <option value="Done">Done</option>
          </select>
        </div>

        {/* Footer */}
        <div className="panel-footer" style={{ margin: '0 -20px -20px', padding: '14px 20px' }}>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>* Required fields</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setIcFormData(initialICForm); setErrors({}); setIcPanelOpen(false); }} className="panel-btn-cancel">Cancel</button>
            <button onClick={handleAddIC} disabled={saving} className="panel-btn-save">
              {saving ? 'Saving...' : 'Save I&C'}
            </button>
          </div>
        </div>
      </SlidePanel>
    </div>
  );
}
