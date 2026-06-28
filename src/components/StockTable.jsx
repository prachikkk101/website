// src/components/StockTable.jsx
import { useState, useMemo } from 'react';
import { stockData } from '../data/stock';
import { exportStockData } from '../utils/exportExcel';
import SlidePanel, { Field, Input, Select, SectionTitle } from './SlidePanel';
import { useToast } from './Toast';

const todayStr = () => new Date().toISOString().split('T')[0];

function getStatus(pct) {
  if (pct < 20) return { label: 'Critical', color: '#dc2626', bg: '#fee2e2' };
  if (pct < 40) return { label: 'Low',      color: '#d97706', bg: '#fef3c7' };
  return                { label: 'OK',       color: '#16a34a', bg: '#dcfce7' };
}

function MiniProgress({ pct, status }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#e5e7eb', overflow: 'hidden', minWidth: 60 }}>
        <div style={{ height: '100%', borderRadius: 3, width: `${Math.min(pct,100)}%`, background: status.color, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 10, background: status.bg, color: status.color, whiteSpace: 'nowrap' }}>
        {status.label}
      </span>
    </div>
  );
}

const SITES = ['Khanna','UE-II','PLA','Kohara'];

export default function StockTable() {
  const { showToast } = useToast();
  const [extraReceived, setExtraReceived] = useState({});
  const [panelOpen,     setPanelOpen]     = useState(false);

  // Export date state
  const [exportDate, setExportDate] = useState(todayStr());

  // Receive Stock panel form
  const [challan,  setChallan]  = useState('');
  const [dateRcv,  setDateRcv]  = useState(todayStr());
  const [site,     setSite]     = useState(SITES[0]);
  const [notes,    setNotes]    = useState('');
  const [qtyMap,   setQtyMap]   = useState({});
  const [formErr,  setFormErr]  = useState({});

  const rows = useMemo(() => {
    return stockData.map(s => {
      const totalReceived = s.received + (extraReceived[s.id] || 0);
      const netUsed  = s.issued - s.returned;
      const totalAvail = s.opening + totalReceived;
      const pct    = totalAvail > 0 ? Math.round(((s.physical_site + s.physical_store) / totalAvail) * 100) : 0;
      const status = getStatus(pct);
      return { ...s, received: totalReceived, netUsed, pct, status };
    });
  }, [extraReceived]);

  function handleExport() {
    exportStockData(rows, exportDate);
  }

  function openPanel() {
    const init = {};
    stockData.forEach(s => { init[s.id] = 0; });
    setQtyMap(init);
    setChallan(''); setDateRcv(todayStr()); setSite(SITES[0]); setNotes(''); setFormErr({});
    setPanelOpen(true);
  }

  function handleSave() {
    const e = {};
    if (!challan.trim()) e.challan = 'Challan / DC Number is required';
    if (!dateRcv)        e.dateRcv = 'Date Received is required';
    setFormErr(e);
    if (Object.keys(e).length > 0) return;

    // Apply received quantities
    const updates = {};
    stockData.forEach(s => {
      const q = Number(qtyMap[s.id] || 0);
      if (q > 0) updates[s.id] = (extraReceived[s.id] || 0) + q;
    });
    if (Object.keys(updates).length > 0) {
      setExtraReceived(prev => ({ ...prev, ...updates }));
    }
    setPanelOpen(false);
    showToast('✓ Stock received and updated');
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', margin: 0 }}>Stock Statement</h2>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: '2px 0 0' }}>{rows.length} materials tracked</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>Export as of</span>
          <input
            type="date"
            value={exportDate}
            onChange={e => setExportDate(e.target.value)}
            style={{ height: 32, border: '1px solid #d1d5db', borderRadius: 4, padding: '0 8px', fontSize: 12 }}
          />
          <button
            onClick={handleExport}
            style={{
              height: 32, background: '#2d6a27', color: '#fff', border: 'none',
              borderRadius: 4, padding: '0 14px', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            ↓ Export Excel
          </button>
          <button
            onClick={openPanel}
            style={{
              height: 32, background: '#1f4e1a', color: '#fff', border: 'none',
              borderRadius: 4, padding: '0 14px', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Receive Stock
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#2d6a27' }}>
                {['Sr.','Material','Unit','Opening','Received','Issued','Returned','Net Used','On Site','In Store','Required','Status'].map(col => (
                  <th key={col} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((s, i) => (
                <tr key={s.id} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb', borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '9px 12px', color: '#94a3b8', fontWeight: 500 }}>{i+1}</td>
                  <td style={{ padding: '9px 12px', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }}>{s.material}</td>
                  <td style={{ padding: '9px 12px', color: '#64748b' }}>{s.unit}</td>
                  <td style={{ padding: '9px 12px' }}>{s.opening}</td>
                  <td style={{ padding: '9px 12px', color: '#2563eb', fontWeight: 500 }}>{s.received}</td>
                  <td style={{ padding: '9px 12px' }}>{s.issued}</td>
                  <td style={{ padding: '9px 12px', color: '#16a34a' }}>{s.returned}</td>
                  <td style={{ padding: '9px 12px', fontWeight: 700 }}>{s.netUsed}</td>
                  <td style={{ padding: '9px 12px' }}>{s.physical_site}</td>
                  <td style={{ padding: '9px 12px' }}>{s.physical_store}</td>
                  <td style={{ padding: '9px 12px' }}>{s.required}</td>
                  <td style={{ padding: '9px 12px', minWidth: 140 }}>
                    <MiniProgress pct={s.pct} status={s.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p style={{ marginTop: 10, fontSize: 11, color: '#94a3b8', fontStyle: 'italic', paddingLeft: 2 }}>
        ℹ️ Materials used per house entry are automatically deducted from Issued Qty.
      </p>

      {/* ── Receive Stock Slide Panel ── */}
      <SlidePanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        title="Receive New Stock"
        onSave={handleSave}
      >
        <div>
          <SectionTitle>Delivery Details</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Challan / DC Number" required error={formErr.challan}>
              <Input value={challan} onChange={e => setChallan(e.target.value)} error={formErr.challan} placeholder="e.g. DC-2026-001" />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Date Received" required error={formErr.dateRcv}>
                <Input type="date" value={dateRcv} onChange={e => setDateRcv(e.target.value)} error={formErr.dateRcv} />
              </Field>
              <Field label="Site" required>
                <Select value={site} onChange={e => setSite(e.target.value)}>
                  {SITES.map(s => <option key={s}>{s}</option>)}
                </Select>
              </Field>
            </div>
          </div>
        </div>

        <div>
          <SectionTitle>Materials Received</SectionTitle>
          <p style={{ fontSize: 11, color: '#64748b', marginBottom: 10 }}>
            Enter received quantities (leave 0 to skip that material).
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stockData.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <label style={{ flex: 1, fontSize: 12, color: '#374151' }}>{s.material}</label>
                <span style={{ fontSize: 11, color: '#94a3b8', width: 32 }}>{s.unit}</span>
                <input
                  type="number" min={0}
                  value={qtyMap[s.id] ?? 0}
                  onChange={e => setQtyMap(prev => ({ ...prev, [s.id]: Number(e.target.value) }))}
                  style={{ width: 80, height: 30, border: '1px solid #d1d5db', borderRadius: 4, padding: '0 8px', fontSize: 13 }}
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <SectionTitle>Notes / Remarks</SectionTitle>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Optional notes about this delivery..."
            rows={3}
            style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 5, padding: '8px 10px', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
          />
        </div>
      </SlidePanel>
    </div>
  );
}
