// src/components/StockTable.jsx
import { useState, useMemo } from 'react';
import { stockData } from '../data/stock';
import { exportStockData } from '../utils/exportExcel';

function getStatus(pct) {
  if (pct < 20) return { label: 'Critical', color: '#dc2626', bg: '#fee2e2' };
  if (pct < 40) return { label: 'Low', color: '#d97706', bg: '#fef3c7' };
  return { label: 'OK', color: '#16a34a', bg: '#dcfce7' };
}

function MiniProgress({ pct, status }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden min-w-[60px]">
        <div
          className="h-full rounded-full progress-bar-fill"
          style={{ width: `${Math.min(pct, 100)}%`, background: status.color }}
        />
      </div>
      <span
        className="text-xs font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap"
        style={{ background: status.bg, color: status.color }}
      >
        {status.label}
      </span>
    </div>
  );
}

const units = ['Mtr', 'Pcs', 'Set', 'Nos', 'Kg'];
const materials = [
  '25mm MDPE Pipe', '32mm PE Pipe', '63mm MDPE Pipe', 'Ball Valve 25mm',
  'Meter Set (Domestic)', 'Tee 32mm', 'Compression Fitting 25mm', 'Pressure Regulator',
];

function ReceiveModal({ onClose, onAdd }) {
  const [material, setMaterial] = useState('');
  const [unit, setUnit] = useState('Mtr');
  const [qty, setQty] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [supplier, setSupplier] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');

  function handleSubmit() {
    if (!material || qty <= 0) return;
    onAdd({ material, unit, qty, date, supplier, invoiceNo });
    onClose();
  }

  return (
    <div
      className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-box w-full max-w-md rounded-2xl overflow-hidden shadow-2xl bg-white">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ background: '#1f4e1a' }}>
          <div className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7ec56f" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <line x1="12" y1="12" x2="12" y2="18"/><line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
            <h2 className="text-white font-bold text-base">Receive Stock</h2>
          </div>
          <button onClick={onClose} className="text-green-300 hover:text-white text-xl w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10">×</button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Material</label>
            <select
              value={material}
              onChange={e => setMaterial(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            >
              <option value="">— Select Material —</option>
              {materials.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Unit</label>
              <select
                value={unit}
                onChange={e => setUnit(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              >
                {units.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Qty Received</label>
              <input
                type="number"
                value={qty}
                onChange={e => setQty(Number(e.target.value))}
                min={1}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Supplier</label>
            <input
              type="text"
              value={supplier}
              onChange={e => setSupplier(e.target.value)}
              placeholder="Supplier name"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Invoice No.</label>
              <input
                type="text"
                value={invoiceNo}
                onChange={e => setInvoiceNo(e.target.value)}
                placeholder="INV-2025-001"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-5 py-4 border-t">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl font-semibold text-sm" style={{ background: '#f3f4f6', color: '#374151' }}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90"
            style={{ background: '#2d6a27' }}
          >
            Log Receipt
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StockTable() {
  const [showModal, setShowModal] = useState(false);
  const [extraReceived, setExtraReceived] = useState({});

  const rows = useMemo(() => {
    return stockData.map(s => {
      const totalReceived = s.received + (extraReceived[s.id] || 0);
      const netUsed = s.issued - s.returned;
      const totalAvail = s.opening + totalReceived;
      const pct = totalAvail > 0 ? Math.round(((s.physical_site + s.physical_store) / totalAvail) * 100) : 0;
      const status = getStatus(pct);
      return { ...s, received: totalReceived, netUsed, pct, status };
    });
  }, [extraReceived]);

  function handleReceive({ material, qty }) {
    const found = stockData.find(s => s.material === material);
    if (found) {
      setExtraReceived(prev => ({ ...prev, [found.id]: (prev[found.id] || 0) + qty }));
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-bold text-gray-800 text-lg">Stock Statement</h2>
          <p className="text-sm text-gray-400">{rows.length} materials tracked</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => exportStockData(rows)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-all hover:bg-green-50"
            style={{ borderColor: '#2d6a27', color: '#2d6a27' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ background: '#2d6a27' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Receive Stock
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#2d6a27' }}>
                {['Sr.', 'Material', 'Unit', 'Opening', 'Received', 'Issued', 'Returned', 'Net Used', 'On Site', 'In Store', 'Required', 'Status'].map(col => (
                  <th key={col} className="px-3 py-3 text-left text-xs font-bold text-white whitespace-nowrap">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((s, i) => (
                <tr key={s.id} className={`tbl-row border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <td className="px-3 py-2.5 text-gray-500 font-medium">{i + 1}</td>
                  <td className="px-3 py-2.5 font-semibold text-gray-800 whitespace-nowrap">{s.material}</td>
                  <td className="px-3 py-2.5 text-gray-500">{s.unit}</td>
                  <td className="px-3 py-2.5 text-gray-700">{s.opening}</td>
                  <td className="px-3 py-2.5 text-blue-600 font-medium">{s.received}</td>
                  <td className="px-3 py-2.5 text-gray-700">{s.issued}</td>
                  <td className="px-3 py-2.5 text-green-600">{s.returned}</td>
                  <td className="px-3 py-2.5 font-bold text-gray-800">{s.netUsed}</td>
                  <td className="px-3 py-2.5 text-gray-700">{s.physical_site}</td>
                  <td className="px-3 py-2.5 text-gray-700">{s.physical_store}</td>
                  <td className="px-3 py-2.5 text-gray-700">{s.required}</td>
                  <td className="px-3 py-2.5 min-w-[140px]">
                    <MiniProgress pct={s.pct} status={s.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Note */}
      <p className="mt-3 text-xs text-gray-400 italic px-1">
        ℹ️ Materials used per house entry are automatically deducted from Issued Qty.
      </p>

      {showModal && (
        <ReceiveModal
          onClose={() => setShowModal(false)}
          onAdd={handleReceive}
        />
      )}
    </div>
  );
}
