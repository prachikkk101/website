// src/pages/Inventory.jsx
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSite } from '../context/SiteContext';
import { useToast } from '../components/Toast';
import SlidePanel from '../components/SlidePanel';
import { siteService } from '../api/siteService';
import { getStock, receiveStock } from '../utils/dataService';

/* ── Status logic ── */
function getStatus(row) {
  const inStore = Number(row.inStoreQty || 0);
  const required = Number(row.requiredQty || 0);
  const total = Number(row.openingQty || 0) + Number(row.receivedQty || 0);
  const pct = total > 0 ? Math.round(((Number(row.onSiteQty || 0) + inStore) / total) * 100) : 0;
  if (pct > 60) return { label: 'OK',       cls: 'badge-ok',       bar: '#16a34a', pct };
  if (pct >= 20) return { label: 'Low',      cls: 'badge-low',      bar: '#d97706', pct };
  return             { label: 'Critical', cls: 'badge-critical', bar: '#dc2626', pct };
}

export default function Inventory() {
  const { selectedSite, sites, siteOptions } = useSite();
  const { showToast } = useToast();

  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Form State
  const [receivedQtys, setReceivedQtys] = useState({});
  const [invoiceNo, setInvoiceNo] = useState('');
  const [supplier, setSupplier] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Fetch stock data
  const fetchStock = useCallback(async () => {
    const isLocalMode = sites.length > 0 && String(sites[0]?.id).startsWith('local-site-');
    if (isLocalMode || String(selectedSite).startsWith('local-site-')) {
      setStock(getStock());
      return;
    }

    if (selectedSite === 'all') {
      if (sites.length === 0) return;
      setLoading(true);
      try {
        const data = await siteService.getSiteStock(sites[0].id);
        const stockList = data.stock || data || [];
        setStock(Array.isArray(stockList) && stockList.length > 0 ? stockList : getStock());
      } catch {
        setStock(getStock());
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(true);
      try {
        const data = await siteService.getSiteStock(selectedSite);
        const stockList = data.stock || data || [];
        setStock(Array.isArray(stockList) && stockList.length > 0 ? stockList : getStock());
      } catch {
        setStock(getStock());
      } finally {
        setLoading(false);
      }
    }
  }, [selectedSite, sites]);

  useEffect(() => {
    fetchStock();
  }, [fetchStock]);

  function resetForm() {
    setReceivedQtys({});
    setInvoiceNo('');
    setSupplier('');
    setDate(new Date().toISOString().split('T')[0]);
    setErrors({});
  }

  const rows = useMemo(() => {
    return stock.map((s, i) => {
      const open = Number(s.openingQty || 0);
      const recv = Number(s.receivedQty || 0);
      const issued = Number(s.issuedQty || 0);
      const ret = Number(s.returnedQty || 0);
      const onSite = Number(s.onSiteQty || 0);
      const inStore = Number(s.inStoreQty || 0);
      const req = Number(s.requiredQty || 0);
      const netUsed = issued - ret;
      const status = getStatus(s);
      const matName = s.material?.name || s.materialName || `Material ${i + 1}`;
      const matUnit = s.material?.unit || s.unit || 'Pcs';
      const matId = s.materialId || s.material?.id || i;
      return { ...s, sr: i + 1, matName, matUnit, matId, open, recv, issued, ret, netUsed, onSite, inStore, req, status };
    });
  }, [stock]);

  /* Totals row */
  const totals = useMemo(() => {
    return rows.reduce((acc, r) => ({
      open: acc.open + r.open,
      recv: acc.recv + r.recv,
      issued: acc.issued + r.issued,
      ret: acc.ret + r.ret,
      netUsed: acc.netUsed + r.netUsed,
      onSite: acc.onSite + r.onSite,
      inStore: acc.inStore + r.inStore,
      req: acc.req + r.req,
    }), { open: 0, recv: 0, issued: 0, ret: 0, netUsed: 0, onSite: 0, inStore: 0, req: 0 });
  }, [rows]);

  async function handleSave() {
    const targetSiteId = selectedSite === 'all' ? sites[0]?.id : selectedSite;
    if (!targetSiteId) {
      showToast('⚠️ Please select a site first');
      return;
    }

    // Build items array from receivedQtys
    const items = Object.entries(receivedQtys)
      .filter(([, qty]) => Number(qty) > 0)
      .map(([materialId, qty]) => ({ materialId, qty: Number(qty) }));

    if (items.length === 0) {
      showToast('⚠️ Enter at least one quantity');
      return;
    }

    setSaving(true);
    try {
      await siteService.receiveStock(targetSiteId, {
        items,
        invoiceNo: invoiceNo || undefined,
        supplier: supplier || undefined,
        date,
      });
    } catch {
      // API offline — persist receipt locally
      // Map materialId-keyed items to index-keyed for receiveStock()
      const indexedItems = items.map(({ materialId, qty }) => {
        const idx = stock.findIndex(s => (s.materialId || s.material?.id || s.id) === materialId);
        return { matIndex: idx, qty };
      }).filter(i => i.matIndex >= 0);
      receiveStock({ challanNo: invoiceNo, date, site: targetSiteId, items: indexedItems });
    }

    showToast('✓ Stock received and updated');
    resetForm();
    setShowModal(false);
    fetchStock();
    setSaving(false);
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ width: 36, height: 36, border: '4px solid #e2e8f0', borderTopColor: '#2d6a27', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ color: '#64748b', fontSize: 13 }}>Loading stock data...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
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
                  <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{r.matName}</td>
                  <td style={{ color: '#64748b' }}>{r.matUnit}</td>
                  <td style={{ textAlign: 'right' }}>{r.open.toLocaleString()}</td>
                  <td style={{ textAlign: 'right', color: '#2d6a27', fontWeight: 600 }}>{r.recv.toLocaleString()}</td>
                  <td style={{ textAlign: 'right' }}>{r.issued.toLocaleString()}</td>
                  <td style={{ textAlign: 'right', color: '#2d6a27' }}>{r.ret.toLocaleString()}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{r.netUsed.toLocaleString()}</td>
                  <td style={{ textAlign: 'right' }}>{r.onSite.toLocaleString()}</td>
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
              {rows.length === 0 && (
                <tr><td colSpan={12} style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>
                  No stock data. Select a site or ensure the database has materials seeded.
                </td></tr>
              )}
              {rows.length > 0 && (
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
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Note */}
      <p style={{ marginTop: 10, fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
        ℹ️ Stock quantities are managed server-side. All transactions are permanently logged.
      </p>

      {/* Slide-in panel for Receive Stock */}
      <SlidePanel isOpen={showModal} onClose={() => { resetForm(); setShowModal(false); }} title="Receive New Stock">
        <div>
          <div className="panel-section-title">Receipt Details</div>
          <div className="panel-field">
            <label className="panel-label">Invoice / Challan No.</label>
            <input type="text" className="panel-input" placeholder="Enter Invoice/Challan Number" value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} />
          </div>
          <div className="panel-field">
            <label className="panel-label">Supplier</label>
            <input type="text" className="panel-input" placeholder="Supplier name" value={supplier} onChange={e => setSupplier(e.target.value)} />
          </div>
          <div className="panel-field">
            <label className="panel-label">Date Received</label>
            <input type="date" className="panel-input" value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>

        <div>
          <div className="panel-section-title">Material Quantities</div>
          {rows.map(item => (
            <div className="panel-field" key={item.matId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{item.matName}</span>
                <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 6 }}>({item.matUnit})</span>
              </div>
              <input type="number" className="panel-input" style={{ width: 100 }} min={0}
                value={receivedQtys[item.matId] || 0}
                onChange={e => setReceivedQtys(prev => ({ ...prev, [item.matId]: Number(e.target.value) }))} />
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="panel-footer" style={{ margin: '0 -20px -20px', padding: '14px 20px' }}>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Enter quantities received</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { resetForm(); setShowModal(false); }} className="panel-btn-cancel">Cancel</button>
            <button onClick={handleSave} className="panel-btn-save" disabled={saving}>
              {saving ? 'Processing...' : 'Receive Stock'}
            </button>
          </div>
        </div>
      </SlidePanel>
    </div>
  );
}
