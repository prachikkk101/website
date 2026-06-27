// src/pages/Inventory.jsx
import { useState, useMemo } from 'react';
import stockData from '../data/stockData';
import { exportStockData } from '../utils/exportExcel';

/* ── Status logic ── */
function getStatus(onSite, inStore, open, recv) {
  const total = open + recv;
  const pct = total > 0 ? Math.round(((onSite + inStore) / total) * 100) : 0;
  if (pct > 60) return { label: 'OK',       cls: 'badge-ok',       bar: '#16a34a', pct };
  if (pct >= 20) return { label: 'Low',      cls: 'badge-low',      bar: '#d97706', pct };
  return             { label: 'Critical', cls: 'badge-critical', bar: '#dc2626', pct };
}

/* ── Receive Stock Modal ── */
const MAT_LIST = stockData.map(s => s.mat);
const UNITS = ['Mtr','Pcs','Set','Nos','Kg'];

function ReceiveModal({ onClose, onAdd }) {
  const [mat,      setMat]      = useState('');
  const [unit,     setUnit]     = useState('Mtr');
  const [qty,      setQty]      = useState(1);
  const [supplier, setSupplier] = useState('');
  const [invoice,  setInvoice]  = useState('');
  const [date,     setDate]     = useState(new Date().toISOString().split('T')[0]);

  function submit() {
    if (!mat || qty < 1) return;
    onAdd({ mat, qty: Number(qty) });
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <span className="modal-title">Receive Stock</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={LBL}>Material</label>
            <select className="gp-select" style={{ width: '100%' }} value={mat} onChange={e => setMat(e.target.value)}>
              <option value="">— Select Material —</option>
              {MAT_LIST.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={LBL}>Unit</label>
              <select className="gp-select" style={{ width: '100%' }} value={unit} onChange={e => setUnit(e.target.value)}>
                {UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label style={LBL}>Qty Received</label>
              <input type="number" className="gp-input" style={{ width: '100%' }} min={1} value={qty} onChange={e => setQty(e.target.value)} />
            </div>
          </div>
          <div>
            <label style={LBL}>Supplier</label>
            <input className="gp-input" style={{ width: '100%' }} placeholder="Supplier name" value={supplier} onChange={e => setSupplier(e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={LBL}>Invoice No.</label>
              <input className="gp-input" style={{ width: '100%' }} placeholder="INV-2025-001" value={invoice} onChange={e => setInvoice(e.target.value)} />
            </div>
            <div>
              <label style={LBL}>Date</label>
              <input type="date" className="gp-input" style={{ width: '100%' }} value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" style={{ flex:1, background:'#f1f5f9', color:'#374151' }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex:1 }} onClick={submit}>Log Receipt</button>
        </div>
      </div>
    </div>
  );
}

const LBL = { display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 };

/* ══════════════ MAIN ══════════════ */
export default function Inventory() {
  const [showModal,     setShowModal]     = useState(false);
  const [extraReceived, setExtraReceived] = useState({});

  const rows = useMemo(() => stockData.map(s => {
    const totalRecv = s.recv + (extraReceived[s.sr] ?? 0);
    const netUsed   = s.issued - s.ret;
    const status    = getStatus(s.onSite, s.inStore, s.open, totalRecv);
    const onSitePct = (s.open + totalRecv) > 0 ? (s.onSite / (s.open + totalRecv)) * 100 : 0;
    return { ...s, recv: totalRecv, netUsed, status, onSitePct };
  }), [extraReceived]);

  function handleReceive({ mat, qty }) {
    const found = stockData.find(s => s.mat === mat);
    if (found) setExtraReceived(prev => ({ ...prev, [found.sr]: (prev[found.sr] ?? 0) + qty }));
  }

  /* Totals row */
  const totals = useMemo(() => rows.reduce((acc, r) => ({
    open:    acc.open    + r.open,
    recv:    acc.recv    + r.recv,
    issued:  acc.issued  + r.issued,
    ret:     acc.ret     + r.ret,
    netUsed: acc.netUsed + r.netUsed,
    onSite:  acc.onSite  + r.onSite,
    inStore: acc.inStore + r.inStore,
    req:     acc.req     + r.req,
  }), { open:0, recv:0, issued:0, ret:0, netUsed:0, onSite:0, inStore:0, req:0 }), [rows]);

  function onSiteColor(r) {
    if (r.onSitePct < 20) return '#dc2626';
    if (r.onSitePct < 40) return '#d97706';
    return '#1e293b';
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

      {showModal && <ReceiveModal onClose={() => setShowModal(false)} onAdd={handleReceive} />}
    </div>
  );
}
