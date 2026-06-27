// src/components/HouseTable.jsx
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useSite } from '../context/SiteContext';
import { useToast } from './Toast';
import SlidePanel from './SlidePanel';
import MeterModal from './MeterModal';
import { pngService } from '../api/pngService';
import { exportHouseData } from '../utils/exportExcel';
import { getHouses, addHouse } from '../utils/dataService';

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

const ACCT_TYPES = ['DOMESTIC', 'COMMERCIAL', 'INDUSTRIAL', 'CNG'];

const initialForm = {
  appNo: '',
  customerName: '',
  mobile: '',
  altMobile: '',
  accountType: 'DOMESTIC',
  houseNo: '',
  address1: '',
  address2: '',
  city: '',
  society: '',
  gcLength: '',
  giPipeMtr: '',
  tfCount: '',
  ivCount: '',
};

export default function HouseTable() {
  const { selectedSite, sites } = useSite();
  const { showToast } = useToast();

  const [houses, setHouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterAcct, setFilterAcct] = useState('');
  const [filterBP, setFilterBP] = useState('');
  const [page, setPage] = useState(1);
  const [modalHouse, setModalHouse] = useState(null);

  // Export dates default to today
  const todayStr = new Date().toISOString().split('T')[0];
  const [exportFrom, setExportFrom] = useState(todayStr);
  const [exportTo, setExportTo] = useState(todayStr);

  // Add Entry Panel State
  const [panelOpen, setPanelOpen] = useState(false);
  const [formData, setFormData] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Fetch connections from API
  const fetchConnections = useCallback(async () => {
    // Detect local mode: site IDs are placeholder strings, not real UUIDs
    const isLocalMode = sites.length > 0 && String(sites[0]?.id).startsWith('local-site-');

    if (selectedSite === 'all') {
      setLoading(true);
      if (isLocalMode) {
        setHouses(getHouses());
        setLoading(false);
        return;
      }
      try {
        const allConns = [];
        for (const site of sites) {
          try {
            const data = await pngService.getConnections(site.id);
            const conns = data.connections || data || [];
            allConns.push(...(Array.isArray(conns) ? conns : []));
          } catch { /* skip failed sites */ }
        }
        setHouses(allConns.length > 0 ? allConns : getHouses());
      } catch {
        setHouses(getHouses());
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(true);
      if (isLocalMode || String(selectedSite).startsWith('local-site-')) {
        setHouses(getHouses());
        setLoading(false);
        return;
      }
      try {
        const data = await pngService.getConnections(selectedSite);
        const conns = data.connections || data || [];
        setHouses(Array.isArray(conns) && conns.length > 0 ? conns : getHouses());
      } catch {
        setHouses(getHouses());
      } finally {
        setLoading(false);
      }
    }
  }, [selectedSite, sites]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  function reset() { setPage(1); }

  const filtered = useMemo(() => {
    return houses.filter(h => {
      if (filterAcct && (h.accountType || '').toUpperCase() !== filterAcct.toUpperCase()) return false;
      if (filterBP && !(h.bpNo || h.appNo || '').includes(filterBP)) return false;
      return true;
    });
  }, [houses, filterAcct, filterBP]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function handleSave() {
    const newErrors = {};
    if (!formData.appNo.trim()) newErrors.appNo = 'Application No. is required';
    if (!formData.customerName.trim()) newErrors.customerName = 'Customer Name is required';
    if (!formData.mobile.trim()) newErrors.mobile = 'Mobile Number is required';
    if (!formData.houseNo.trim()) newErrors.houseNo = 'House No. is required';

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      showToast('⚠️ Please fill in all required fields');
      return;
    }

    const targetSiteId = selectedSite === 'all' ? sites[0]?.id : selectedSite;
    if (!targetSiteId) {
      showToast('⚠️ Please select a site first');
      return;
    }

    setSaving(true);
    try {
      await pngService.createConnection(targetSiteId, {
        appNo: formData.appNo,
        customerName: formData.customerName,
        mobile: formData.mobile,
        altMobile: formData.altMobile || undefined,
        accountType: formData.accountType,
        houseNo: formData.houseNo,
        address1: formData.address1 || formData.houseNo,
        address2: formData.address2 || undefined,
        city: formData.city || 'HISAR',
        society: formData.society || undefined,
        gcLength: formData.gcLength ? Number(formData.gcLength) : undefined,
        giPipeMtr: formData.giPipeMtr ? Number(formData.giPipeMtr) : undefined,
        tfCount: formData.tfCount ? Number(formData.tfCount) : undefined,
        ivCount: formData.ivCount ? Number(formData.ivCount) : undefined,
      });
    } catch {
      // API unreachable — persist locally
      addHouse({
        appNo: formData.appNo,
        bpNo: formData.appNo,
        name: formData.customerName,
        mobile: formData.mobile,
        altMobile: formData.altMobile,
        acctType: formData.accountType,
        houseNo: formData.houseNo,
        area: formData.address1 || formData.address2 || '',
        city: formData.city || 'HISAR',
        site: sites.find(s => s.id === targetSiteId)?.name || '',
        gcStatus: '-', giStatus: '-', rfc: '-', ngStatus: '-', saralStatus: '-',
        meterNo: '-', meterDate: '-', meterPhoto: false,
      });
    }

    showToast('✓ Connection created successfully');
    setFormData(initialForm);
    setErrors({});
    setPanelOpen(false);
    fetchConnections();
    setSaving(false);
  }

  function handleCancel() {
    setFormData(initialForm);
    setErrors({});
    setPanelOpen(false);
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{
          width: 36, height: 36, border: '4px solid #e2e8f0',
          borderTopColor: '#2d6a27', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite', margin: '0 auto 12px',
        }} />
        <p style={{ color: '#64748b', fontSize: 13 }}>Loading connections...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  return (
    <div>
      {/* ── Title Heading ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1f4e1a', margin: 0 }}>
          House Connections
        </h1>
        <button
          onClick={() => setPanelOpen(true)}
          className="btn btn-primary"
          style={{ background: '#2d6a27', color: 'white', padding: '0 20px', height: 36, fontSize: 13, borderRadius: 6, fontWeight: 600 }}
        >
          + Add New Entry
        </button>
      </div>

      {/* ── Export ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#475569', fontWeight: 500 }}>Export entries from</span>
          <input type="date" className="gp-input" style={{ height: 32, fontSize: 12 }} value={exportFrom} onChange={e => setExportFrom(e.target.value)} />
          <span style={{ fontSize: 12, color: '#475569', fontWeight: 500 }}>to</span>
          <input type="date" className="gp-input" style={{ height: 32, fontSize: 12 }} value={exportTo} onChange={e => setExportTo(e.target.value)} />
          <button onClick={() => exportHouseData(filtered, exportFrom, exportTo)} className="btn btn-outline">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export Excel
          </button>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="card section-block" style={{ padding: '10px 14px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <select className="gp-select-dark" style={{ width: 160 }} value={filterAcct} onChange={e => { setFilterAcct(e.target.value); reset(); }}>
            <option value="">-- Account Type --</option>
            {ACCT_TYPES.map(a => <option key={a}>{a}</option>)}
          </select>
          <input className="gp-input-dark" style={{ width: 150 }} placeholder="BP / App Number" value={filterBP} onChange={e => { setFilterBP(e.target.value); reset(); }} />
          <button className="btn btn-primary" onClick={reset}>Search</button>
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
                {['Acct','App No.','BP No.','Name','Mobile','House No.','City','Status','Action'].map(col => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map(h => (
                <tr key={h.id}>
                  <td style={{ fontSize: 11, color: '#64748b' }}>{h.accountType}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{h.appNo}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{h.bpNo || '—'}</td>
                  <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{h.customerName}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{h.mobile}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{h.houseNo}</td>
                  <td>{h.city}</td>
                  <td><StatusBadge val={h.status} /></td>
                  <td>
                    <button
                      onClick={e => { e.stopPropagation(); setModalHouse(h); }}
                      className="btn btn-primary btn-sm"
                      style={{ borderRadius: 4 }}
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
              {paged.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8' }}>
                    {'No records match the current filters.'}
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
            {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i+1).map(p => (
              <button key={p} className={`page-btn${p===page?' active':''}`} onClick={() => setPage(p)}>{p}</button>
            ))}
            <button className="page-btn" onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages}>→</button>
          </div>
        )}
      </div>

      {/* Meter Modal */}
      {modalHouse && (
        <MeterModal
          house={modalHouse}
          onClose={() => setModalHouse(null)}
          onSave={() => { setModalHouse(null); fetchConnections(); }}
        />
      )}

      {/* ── Add Entry Panel ── */}
      <SlidePanel isOpen={panelOpen} onClose={handleCancel} title="Add House Connection">
        {/* Customer Details */}
        <div>
          <div className="panel-section-title">Customer Details</div>
          <div className="panel-field">
            <label className="panel-label">Application No.*</label>
            <input type="text" className={`panel-input${errors.appNo ? ' error' : ''}`} value={formData.appNo}
              onChange={e => setFormData({ ...formData, appNo: e.target.value })} placeholder="Unique application number" />
            {errors.appNo && <p className="panel-error-text">{errors.appNo}</p>}
          </div>
          <div className="panel-field">
            <label className="panel-label">Customer Name*</label>
            <input type="text" className={`panel-input${errors.customerName ? ' error' : ''}`} value={formData.customerName}
              onChange={e => setFormData({ ...formData, customerName: e.target.value })} placeholder="Customer Name" />
            {errors.customerName && <p className="panel-error-text">{errors.customerName}</p>}
          </div>
          <div className="panel-field">
            <label className="panel-label">Mobile Number*</label>
            <input type="text" className={`panel-input${errors.mobile ? ' error' : ''}`} value={formData.mobile}
              onChange={e => setFormData({ ...formData, mobile: e.target.value })} placeholder="Mobile Number" />
            {errors.mobile && <p className="panel-error-text">{errors.mobile}</p>}
          </div>
          <div className="panel-field">
            <label className="panel-label">Account Type</label>
            <select className="panel-select" value={formData.accountType}
              onChange={e => setFormData({ ...formData, accountType: e.target.value })}>
              {ACCT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {/* Address */}
        <div>
          <div className="panel-section-title">Address</div>
          <div className="panel-field">
            <label className="panel-label">House No.*</label>
            <input type="text" className={`panel-input${errors.houseNo ? ' error' : ''}`} value={formData.houseNo}
              onChange={e => setFormData({ ...formData, houseNo: e.target.value })} placeholder="House No." />
            {errors.houseNo && <p className="panel-error-text">{errors.houseNo}</p>}
          </div>
          <div className="panel-field">
            <label className="panel-label">Address Line 1</label>
            <input type="text" className="panel-input" value={formData.address1}
              onChange={e => setFormData({ ...formData, address1: e.target.value })} placeholder="Address" />
          </div>
          <div className="panel-field">
            <label className="panel-label">City</label>
            <input type="text" className="panel-input" value={formData.city}
              onChange={e => setFormData({ ...formData, city: e.target.value })} placeholder="City" />
          </div>
        </div>

        {/* Pipe Details */}
        <div>
          <div className="panel-section-title">Pipe Details</div>
          <div className="panel-field" style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label className="panel-label">GC Length (mtr)</label>
              <input type="number" className="panel-input" value={formData.gcLength}
                onChange={e => setFormData({ ...formData, gcLength: e.target.value })} placeholder="0" />
            </div>
            <div style={{ flex: 1 }}>
              <label className="panel-label">GI Pipe (mtr)</label>
              <input type="number" className="panel-input" value={formData.giPipeMtr}
                onChange={e => setFormData({ ...formData, giPipeMtr: e.target.value })} placeholder="0" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="panel-footer" style={{ margin: '0 -20px -20px', padding: '14px 20px' }}>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>* Required fields</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleCancel} className="panel-btn-cancel">Cancel</button>
            <button onClick={handleSave} className="panel-btn-save" disabled={saving}>
              {saving ? 'Saving...' : 'Save Entry'}
            </button>
          </div>
        </div>
      </SlidePanel>
    </div>
  );
}
