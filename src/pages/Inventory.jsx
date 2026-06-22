// src/pages/Inventory.jsx
import { useState, useMemo } from 'react';
import { useSite } from '../context/SiteContext';
import { useToast } from '../components/Toast';
import SlidePanel from '../components/SlidePanel';
import { exportStockData } from '../utils/exportExcel';

/* ── Status logic ── */
function getStatus(onSite, inStore, open, recv) {
  const total = open + recv;
  const pct = total > 0 ? Math.round(((onSite + inStore) / total) * 100) : 0;
  if (pct > 60) return { label: 'OK',       cls: 'badge-ok',       bar: '#16a34a', pct };
  if (pct >= 20) return { label: 'Low',      cls: 'badge-low',      bar: '#d97706', pct };
  return             { label: 'Critical', cls: 'badge-critical', bar: '#dc2626', pct };
}

export default function Inventory() {
  const { stock, setStock } = useSite();
  const { showToast } = useToast();

  const [showModal, setShowModal] = useState(false);

  // Form State
  const [challan, setChallan] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [site, setSite] = useState('');
  const [receivedQtys, setReceivedQtys] = useState({});
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState({});

  function resetForm() {
    setChallan('');
    setDate(new Date().toISOString().split('T')[0]);
    setSite('');
    setReceivedQtys({});
    setNotes('');
    setErrors({});
  }

  const rows = useMemo(() => {
    return stock.map(s => {
      const netUsed   = s.issued - s.ret;
      const status    = getStatus(s.onSite, s.inStore, s.open, s.recv);
      const onSitePct = (s.open + s.recv) > 0 ? (s.onSite / (s.open + s.recv)) * 100 : 0;
      return { ...s, netUsed, status, onSitePct };
    });
  }, [stock]);

  /* Totals row */
  const totals = useMemo(() => {
    return rows.reduce((acc, r) => ({
      open:    acc.open    + r.open,
      recv:    acc.recv    + r.recv,
      issued:  acc.issued  + r.issued,
      ret:     acc.ret     + r.ret,
      netUsed: acc.netUsed + r.netUsed,
      onSite:  acc.onSite  + r.onSite,
      inStore: acc.inStore + r.inStore,
      req:     acc.req     + r.req,
    }), { open:0, recv:0, issued:0, ret:0, netUsed:0, onSite:0, inStore:0, req:0 });
  }, [rows]);

  function onSiteColor(r) {
    if (r.onSitePct < 20) return '#dc2626';
    if (r.onSitePct < 40) return '#d97706';
    return '#1e293b';
  }

  function handleQtyChange(sr, val) {
    setReceivedQtys(prev => ({
      ...prev,
      [sr]: val
    }));
  }

  function handleSave() {
    const newErrors = {};
    if (!challan.trim()) newErrors.challan = 'Challan / DC Number is required';
    if (!date) newErrors.date = 'Date Received is required';
    if (!site) newErrors.site = 'Site is required';

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      showToast('⚠️ Please fill in all required fields');
      return;
    }

    // Update global stock
    setStock(prevStock => prevStock.map(item => {
      const qty = Number(receivedQtys[item.sr] || 0);
      if (qty > 0) {
        return {
          ...item,
          recv: item.recv + qty,
          inStore: item.inStore + qty
        };
      }
      return item;
    }));

    showToast('✓ Stock received and updated');
    resetForm();
    setShowModal(false);
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1f4e1a', margin: 0 }}>Stock Statement</h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '2px 0 0' }}>{rows.length} materials tracked</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={() => exportStockData(rows)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export
          </button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Receive Stock
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="gp-table">
            <thead>
              <tr>
                <th style={{ width: 40, textAlign: 'center' }}>Sr.</th>
                <th style={{ minWidth: 180 }}>Material</th>
                <th style={{ width: 60 }}>Unit</th>
                <th style={{ textAlign: 'right' }}>Opening</th>
                <th style={{ textAlign: 'right' }}>Received</th>
                <th style={{ textAlign: 'right' }}>Issued</th>
                <th style={{ textAlign: 'right' }}>Returned</th>
                <th style={{ textAlign: 'right' }}>Net Used</th>
                <th style={{ textAlign: 'right' }}>On Site</th>
                <th style={{ textAlign: 'right' }}>In Store</th>
                <th style={{ textAlign: 'right' }}>Required</th>
                <th style={{ minWidth: 140 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.sr}>
                  <td style={{ textAlign: 'center', color: '#94a3b8', fontWeight: 500 }}>{r.sr}</td>
                  <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{r.mat}</td>
                  <td style={{ color: '#64748b' }}>{r.unit}</td>
                  <td style={{ textAlign: 'right' }}>{r.open.toLocaleString()}</td>
                  <td style={{ textAlign: 'right', color: '#2d6a27', fontWeight: 600 }}>{r.recv.toLocaleString()}</td>
                  <td style={{ textAlign: 'right' }}>{r.issued.toLocaleString()}</td>
                  <td style={{ textAlign: 'right', color: '#2d6a27' }}>{r.ret.toLocaleString()}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{r.netUsed.toLocaleString()}</td>
                  <td style={{ textAlign: 'right', color: onSiteColor(r) }}>{r.onSite.toLocaleString()}</td>
                  <td style={{ textAlign: 'right' }}>{r.inStore.toLocaleString()}</td>
                  <td style={{ textAlign: 'right', color: r.req > 0 ? '#c0440a' : '#94a3b8', fontWeight: r.req > 0 ? 600 : 400 }}>
                    {r.req > 0 ? r.req.toLocaleString() : '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 80, height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden', flexShrink: 0 }}>
                        <div style={{ height: '100%', width: `${Math.min(r.status.pct,100)}%`, background: r.status.bar, borderRadius: 4, transition: 'width 0.6s' }} />
                      </div>
                      <span className={`badge ${r.status.cls}`}>{r.status.label}</span>
                    </div>
                  </td>
                </tr>
              ))}
              {/* Totals row */}
              <tr style={{ background: '#f0f7ee', fontWeight: 700 }}>
                <td colSpan={3} style={{ textAlign: 'right', fontWeight: 700, color: '#1f4e1a' }}>TOTAL</td>
                <td style={{ textAlign: 'right' }}>{totals.open.toLocaleString()}</td>
                <td style={{ textAlign: 'right', color: '#2d6a27' }}>{totals.recv.toLocaleString()}</td>
                <td style={{ textAlign: 'right' }}>{totals.issued.toLocaleString()}</td>
                <td style={{ textAlign: 'right', color: '#2d6a27' }}>{totals.ret.toLocaleString()}</td>
                <td style={{ textAlign: 'right' }}>{totals.netUsed.toLocaleString()}</td>
                <td style={{ textAlign: 'right' }}>{totals.onSite.toLocaleString()}</td>
                <td style={{ textAlign: 'right' }}>{totals.inStore.toLocaleString()}</td>
                <td style={{ textAlign: 'right' }}>{totals.req.toLocaleString()}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Note */}
      <p style={{ marginTop: 10, fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
        ℹ️ Materials used per house entry are automatically deducted from Issued Qty.
      </p>

      {/* Slide-in panel for Receive Stock */}
      <SlidePanel
        isOpen={showModal}
        onClose={() => { resetForm(); setShowModal(false); }}
        title="Receive New Stock"
      >
        <div>
          <div className="panel-section-title">Log Receipt Details</div>
          <div className="panel-field">
            <label className="panel-label">Challan / DC Number*</label>
            <input
              type="text"
              className={`panel-input${errors.challan ? ' error' : ''}`}
              placeholder="Enter Challan/DC Number"
              value={challan}
              onChange={e => setChallan(e.target.value)}
            />
            {errors.challan && <p className="panel-error-text">{errors.challan}</p>}
          </div>

          <div className="panel-field">
            <label className="panel-label">Date Received*</label>
            <input
              type="date"
              className={`panel-input${errors.date ? ' error' : ''}`}
              value={date}
              onChange={e => setDate(e.target.value)}
            />
            {errors.date && <p className="panel-error-text">{errors.date}</p>}
          </div>

          <div className="panel-field">
            <label className="panel-label">Site*</label>
            <select
              className={`panel-select${errors.site ? ' error' : ''}`}
              value={site}
              onChange={e => setSite(e.target.value)}
            >
              <option value="">Select Site</option>
              {['Khanna', 'UE-II', 'PLA', 'Kohara'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {errors.site && <p className="panel-error-text">{errors.site}</p>}
          </div>
        </div>

        <div>
          <div className="panel-section-title">Material Quantities</div>
          {stock.map(item => (
            <div className="panel-field" key={item.sr} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{item.mat}</span>
                <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 6 }}>({item.unit})</span>
              </div>
              <input
                type="number"
                className="panel-input"
                style={{ width: 100 }}
                min={0}
                value={receivedQtys[item.sr] || 0}
                onChange={e => handleQtyChange(item.sr, Number(e.target.value))}
              />
            </div>
          ))}
        </div>

        <div>
          <div className="panel-section-title">Additional Info</div>
          <div className="panel-field">
            <label className="panel-label">Notes / Remarks</label>
            <textarea
              className="panel-input"
              style={{ height: 60, padding: '8px 10px', resize: 'vertical' }}
              placeholder="Notes or remarks..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="panel-footer" style={{ margin: '0 -20px -20px', padding: '14px 20px' }}>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>* Required fields</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { resetForm(); setShowModal(false); }} className="panel-btn-cancel">Cancel</button>
            <button onClick={handleSave} className="panel-btn-save">Receive Stock</button>
          </div>
        </div>
      </SlidePanel>
    </div>
  );
}
