// src/pages/ICWork.jsx
import { useState, useMemo, useEffect, useContext } from 'react';
import { useSite } from '../context/SiteContext';
import { AuthContext } from '../context/AuthContext';
import { icWorkAPI } from '../utils/api';
import SlidePanel, { Field, Input, Select } from '../components/SlidePanel';
import { useToast } from '../components/Toast';

const STATUSES = ['All', 'Done', 'Pending'];

const EMPTY_FORM = {
  customerName: '',
  address: '',
  icDate: '',
  regulatorPoutMbar: '10.0',
  flowRateScmh: '1.0',
  regulatorNo: '',
  meterSerialNo: '',
  status: 'Pending',
};

export default function ICWork() {
  const { showToast } = useToast();
  const { user } = useContext(AuthContext);
  const { selectedSiteId } = useSite();
  const siteId = selectedSiteId || null;

  const [allData, setAllData] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [filterArea, setFilterArea] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');

  // Form Panel
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});

  const canWrite = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';

  // Load records
  useEffect(() => {
    document.title = 'GP-PMS — I&C Work';
    if (siteId) {
      setLoading(true);
      icWorkAPI.getAll(siteId)
        .then(records => {
          setAllData(records || []);
        })
        .catch(err => {
          console.error('Failed to load IC work:', err);
          showToast('❌ Failed to load I&C work records.');
        })
        .finally(() => setLoading(false));
    } else {
      setAllData([]);
    }
  }, [siteId]);

  // Derived filter options
  const areaOptions = useMemo(() => {
    const areas = new Set();
    allData.forEach(r => {
      // Find area in address or check if address is area
      if (r.address) {
        // extract area
        const parts = r.address.split(',');
        const area = parts[parts.length - 1]?.trim();
        if (area) areas.add(area);
      }
    });
    return ['All', ...Array.from(areas)];
  }, [allData]);

  // Filtered rows
  const filtered = useMemo(() => {
    return allData.filter(r => {
      if (filterStatus !== 'All' && r.status !== filterStatus) return false;
      if (filterArea && filterArea !== 'All') {
        if (!r.address?.toLowerCase().includes(filterArea.toLowerCase())) return false;
      }
      return true;
    });
  }, [allData, filterStatus, filterArea]);

  // KPI Calculations
  const doneCount = useMemo(() => allData.filter(r => r.status === 'Done').length, [allData]);
  const pendingCount = useMemo(() => allData.filter(r => r.status === 'Pending').length, [allData]);

  // Handlers
  const handleOpenAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setPanelOpen(true);
  };

  const handleOpenEdit = (row) => {
    if (!canWrite) return;
    setEditingId(row.id);
    setForm({
      customerName: row.customerName || '',
      address: row.address || '',
      icDate: row.icDate ? row.icDate.split('T')[0] : '',
      regulatorPoutMbar: row.regulatorPoutMbar?.toString() || '10.0',
      flowRateScmh: row.flowRateScmh?.toString() || '1.0',
      regulatorNo: row.regulatorNo || '',
      meterSerialNo: row.meterSerialNo || '',
      status: row.status || 'Pending',
    });
    setErrors({});
    setPanelOpen(true);
  };

  const validate = () => {
    const errs = {};
    if (!form.customerName.trim()) errs.customerName = 'Customer name is required';
    if (!form.address.trim()) errs.address = 'Address is required';
    if (isNaN(Number(form.regulatorPoutMbar))) errs.regulatorPoutMbar = 'Must be a valid decimal number';
    if (isNaN(Number(form.flowRateScmh))) errs.flowRateScmh = 'Must be a valid decimal number';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    if (!siteId) {
      showToast('❌ No active site selected.', 'error');
      return;
    }

    try {
      const payload = {
        ...form,
        regulatorPoutMbar: parseFloat(form.regulatorPoutMbar),
        flowRateScmh: parseFloat(form.flowRateScmh),
        icDate: form.icDate ? new Date(form.icDate).toISOString() : null,
      };

      if (editingId) {
        const updated = await icWorkAPI.update(siteId, editingId, payload);
        setAllData(prev => prev.map(r => r.id === editingId ? updated : r));
        showToast('✓ I&C record updated successfully');
      } else {
        const created = await icWorkAPI.create(siteId, payload);
        setAllData(prev => [created, ...prev]);
        showToast('✓ I&C record added successfully');
      }
      setPanelOpen(false);
    } catch (err) {
      console.error('Failed to save I&C record:', err);
      showToast('❌ Failed to save record.');
    }
  };

  return (
    <div>
      {/* Title & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1f4e1a', margin: 0 }}>
          I&C Work — Installation & Commissioning
        </h1>
        {canWrite && (
          <button className="btn btn-primary" onClick={handleOpenAdd}>
            + Add I&C Entry
          </button>
        )}
      </div>

      {/* KPI tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16, maxWidth: 400 }}>
        <div className="kpi-tile" style={{ background: '#2d6a27' }}>
          <p className="kpi-label">I&C Done</p>
          <p className="kpi-value">{doneCount}</p>
        </div>
        <div className="kpi-tile" style={{ background: '#c0440a' }}>
          <p className="kpi-label">Pending</p>
          <p className="kpi-value">{pendingCount}</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="card section-block" style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Filter Area:</span>
        <select className="gp-select" value={filterArea} onChange={e => setFilterArea(e.target.value)}>
          {areaOptions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginLeft: 12 }}>Status:</span>
        <select className="gp-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="gp-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>Sr.</th>
                <th style={{ minWidth: 200 }}>Customer / Site Name</th>
                <th style={{ minWidth: 160 }}>Address</th>
                <th>I&C Date</th>
                <th>Regulator Serial No.</th>
                <th>Meter Serial No.</th>
                <th>Pressure (mbar)</th>
                <th>Flow Rate (SCMH)</th>
                <th>Status</th>
                {canWrite && <th style={{ width: 80 }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.id}>
                  <td style={{ textAlign: 'center', color: '#94a3b8' }}>{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{r.customerName}</td>
                  <td style={{ fontSize: 11.5, color: '#64748b' }}>{r.address}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 11 }}>
                    {r.icDate ? r.icDate.split('T')[0] : '—'}
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.regulatorNo || '—'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.meterSerialNo || '—'}</td>
                  <td style={{ textAlign: 'right' }}>{parseFloat(r.regulatorPoutMbar)}</td>
                  <td style={{ textAlign: 'right' }}>{parseFloat(r.flowRateScmh)}</td>
                  <td>
                    <span className={`badge ${r.status === 'Done' ? 'badge-done' : 'badge-updated'}`}>
                      {r.status}
                    </span>
                  </td>
                  {canWrite && (
                    <td>
                      <button className="btn btn-outline" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => handleOpenEdit(r)}>
                        Edit
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={canWrite ? 10 : 9} style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
                    {loading ? 'Loading records...' : 'No records found for this site.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-out Add/Edit Panel */}
      <SlidePanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        title={editingId ? 'Edit I&C Record' : 'Add New I&C Record'}
        onSave={handleSave}
      >
        <Field label="Customer / Site Name *" error={errors.customerName}>
          <Input value={form.customerName} onChange={val => setForm(p => ({ ...p, customerName: val }))} />
        </Field>
        <Field label="Address *" error={errors.address}>
          <Input value={form.address} onChange={val => setForm(p => ({ ...p, address: val }))} />
        </Field>
        <Field label="I&C Date">
          <Input type="date" value={form.icDate} onChange={val => setForm(p => ({ ...p, icDate: val }))} />
        </Field>
        <Field label="Regulator Serial No.">
          <Input value={form.regulatorNo} onChange={val => setForm(p => ({ ...p, regulatorNo: val }))} />
        </Field>
        <Field label="Meter Serial No.">
          <Input value={form.meterSerialNo} onChange={val => setForm(p => ({ ...p, meterSerialNo: val }))} />
        </Field>
        <Field label="Outlet Pressure (mbar) *" error={errors.regulatorPoutMbar}>
          <Input value={form.regulatorPoutMbar} onChange={val => setForm(p => ({ ...p, regulatorPoutMbar: val }))} />
        </Field>
        <Field label="Flow Rate (SCMH) *" error={errors.flowRateScmh}>
          <Input value={form.flowRateScmh} onChange={val => setForm(p => ({ ...p, flowRateScmh: val }))} />
        </Field>
        <Field label="Status">
          <Select value={form.status} onChange={val => setForm(p => ({ ...p, status: val }))} options={['Pending', 'Done']} />
        </Field>
      </SlidePanel>
    </div>
  );
}
