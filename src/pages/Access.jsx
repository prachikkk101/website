// src/pages/Access.jsx
import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { adminService } from '../api/adminService';
import api from '../utils/api';

function fmtDate(iso) {
  try { return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}

const ADMIN_EMAILS = ['oxygenprotech@gmail.com', 'radhe.sangwan1980@gmail.com'];

export default function Access() {
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();
  const navigate = useNavigate();

  const isAdmin = (
    user?.role === 'ADMIN' || user?.role === 'admin'
  );
  const isSupervisor = user?.role === 'SUPERVISOR';

  const [usersList, setUsersList] = useState([]);
  const [sites, setSites] = useState([]);
  const [selectedSiteForUser, setSelectedSiteForUser] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [submittedMessage, setSubmittedMessage] = useState('');

  // GA Location form state
  const [showLocModal, setShowLocModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // { type: 'Area' | 'City' | 'GA', site: SiteObject }
  const [locName, setLocName] = useState('');
  const [locStatus, setLocStatus] = useState('Active');
  const [locCities, setLocCities] = useState([{ cityName: '', areasText: '' }]);

  function addCityRow() { setLocCities(prev => [...prev, { cityName: '', areasText: '' }]); }
  function removeCityRow(idx) { setLocCities(prev => prev.filter((_, i) => i !== idx)); }
  function updateCityRow(idx, field, val) { setLocCities(prev => prev.map((c, i) => i === idx ? { ...c, [field]: val } : c)); }

  // Edit Details modal state
  const [editSite, setEditSite] = useState(null);  // site object being edited
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState({});

  function openEditModal(site) {
    setEditForm({
      name: site.name || '',
      location: site.location || '',
      chargeArea: site.chargeArea || '',
      zone: site.zone || '',
      district: site.district || '',
      status: site.status || 'Active',
    });
    setEditSite(site);
  }

  async function handleEditSave() {
    if (!editSite) return;
    setEditSaving(true);
    try {
      await adminService.updateSite(editSite.id, editForm);
      showToast('✓ Site updated successfully');
      setEditSite(null);
      const res = await api.get('/sites');
      if (res.data?.success && res.data?.sites) setSites(res.data.sites);
    } catch (err) {
      showToast('❌ ' + (err.response?.data?.error || 'Failed to update site.'));
    } finally {
      setEditSaving(false);
    }
  }

  // Delete confirmation state
  const [deletePending, setDeletePending] = useState(null); // site object
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function handleDeleteConfirm() {
    if (!deletePending) return;
    setDeleteLoading(true);
    try {
      await adminService.deleteSite(deletePending.id);
      showToast(`✓ "${deletePending.name}" and all associated records deleted.`);
      setDeletePending(null);
      const res = await api.get('/sites');
      if (res.data?.success && res.data?.sites) setSites(res.data.sites);
    } catch (err) {
      showToast('❌ ' + (err.response?.data?.error || 'Failed to delete site.'));
    } finally {
      setDeleteLoading(false);
    }
  }

  // Request form state
  const [rName, setRName] = useState(user?.name || '');
  const [rEmail, setREmail] = useState(user?.email || '');
  const [rSite, setRSite] = useState('');
  const [rReason, setRReason] = useState('');

  useEffect(() => {
    document.title = 'GP-PMS \u2014 Access Management';

    // Load sites list from backend
    api.get('/sites')
      .then(res => {
        if (res.data?.success && res.data?.sites) {
          setSites(res.data.sites);
        }
      })
      .catch(err => {
        console.error('Failed to load sites:', err);
      });

    // Load users list if user is ADMIN
    if (isAdmin) {
      adminService.getUsers()
        .then(res => {
          if (res?.success && res?.users) {
            setUsersList(res.users);
          }
        })
        .catch(err => {
          console.error('Failed to load users:', err);
        });
    }
  }, [isAdmin]);

  const allSiteNames = sites.map(s => s.name);

  // ── Request Access (Verbal/Notification placeholder) ──
  function handleSubmitRequest() {
    if (!rName.trim() || !rSite) return;
    setShowModal(false);
    setSubmittedMessage(`Access request for site "${rSite}" sent to administrators verbally.`);
    setTimeout(() => setSubmittedMessage(''), 6000);
  }

  // ── Assign User to Site ──
  async function assignUserToSite(userId) {
    const siteId = selectedSiteForUser[userId];
    if (!siteId || siteId === 'all') {
      showToast('⚠️ Please select a site first.');
      return;
    }
    try {
      await adminService.assignUserToSite(siteId, { userId });
      showToast('✓ User assigned to site successfully');

      // Refresh user list
      const res = await adminService.getUsers();
      if (res?.success && res?.users) {
        setUsersList(res.users);
      }
    } catch (err) {
      console.error('Failed to assign user to site:', err);
      showToast('❌ Failed to assign user to site.');
    }
  }

  // ── Remove User (Delete from backend DB) ──
  async function removeUser(userId, email) {
    const first = window.confirm(`Remove ${email} from the system?\n\nThis will revoke their access completely.`);
    if (!first) return;
    const second = window.confirm(`FINAL CONFIRMATION\n\nAre you absolutely sure you want to permanently remove ${email}?\n\nThis cannot be undone.`);
    if (!second) return;
    try {
      await adminService.deleteUser(userId);
      setUsersList(prev => prev.filter(u => u.id !== userId));
      showToast(`✓ User ${email} has been removed`);
    } catch (err) {
      console.error('Failed to delete user:', err);
      showToast('❌ Failed to remove user.');
    }
  }

  // ── Add GA Location (Bridge to backend flat Site creation) ──
  async function handleAddLocation() {
    if (!locName.trim()) { showToast('⚠️ Location name is required'); return; }

    const sitesToCreate = [];
    locCities.forEach((c) => {
      const cityName = c.cityName.trim();
      if (!cityName) return;

      const areas = c.areasText.split(',').map(a => a.trim()).filter(Boolean);
      if (areas.length === 0) {
        sitesToCreate.push({
          name: `${cityName} — General`,
          location: cityName,
          gaName: locName.trim(),
          chargeArea: 'General',
          zone: 'Zone 1',
          district: cityName
        });
      } else {
        areas.forEach((area) => {
          sitesToCreate.push({
            name: `${cityName} — ${area}`,
            location: cityName,
            gaName: locName.trim(),
            chargeArea: area,
            zone: 'Zone 1',
            district: cityName
          });
        });
      }
    });

    if (sitesToCreate.length === 0) {
      showToast('⚠️ Add at least one city and area.');
      return;
    }

    try {
      showToast('⏳ Creating sites on backend...');
      for (const sitePayload of sitesToCreate) {
        await api.post('/sites', sitePayload);
      }

      showToast('✓ GA Location and Sites created on backend');

      // Refresh sites list and location context lists
      const res = await api.get('/sites');
      if (res.data?.success && res.data?.sites) {
        setSites(res.data.sites);
      }

      // Reset state and close modal
      setShowLocModal(false);
      setLocName('');
      setLocStatus('Active');
      setLocCities([{ cityName: '', areasText: '' }]);
    } catch (err) {
      console.error('Failed to create sites:', err);
      showToast('❌ Failed to create sites.');
    }
  }

  // ── Add City (Backend Site) ──
  async function handleAddCity(siteId) {
    const parentSite = sites.find(s => s.id === siteId);
    if (!parentSite) return;

    const cityName = prompt('Enter new city name to add to this GA location:');
    if (!cityName || !cityName.trim()) return;
    const areasInput = prompt('Enter areas for this city (comma-separated, optional):') || '';
    const areas = areasInput.split(',').map(a => a.trim()).filter(Boolean);

    try {
      const sitesToCreate = [];
      if (areas.length === 0) {
        sitesToCreate.push({
          name: `${cityName.trim()} — General`,
          location: cityName.trim(),
          gaName: parentSite.gaName || parentSite.name,
          chargeArea: 'General',
          zone: 'Zone 1',
          district: cityName.trim()
        });
      } else {
        areas.forEach(area => {
          sitesToCreate.push({
            name: `${cityName.trim()} — ${area}`,
            location: cityName.trim(),
            gaName: parentSite.gaName || parentSite.name,
            chargeArea: area,
            zone: 'Zone 1',
            district: cityName.trim()
          });
        });
      }

      showToast('⏳ Adding city and sites...');
      for (const sitePayload of sitesToCreate) {
        await api.post('/sites', sitePayload);
      }

      showToast('✓ City and sites added successfully');
      const res = await api.get('/sites');
      if (res.data?.success && res.data?.sites) {
        setSites(res.data.sites);
      }
    } catch (err) {
      console.error('Failed to add city sites:', err);
      showToast('❌ Failed to add city.');
    }
  }

  // ── Add Area (Backend Site) ──
  async function handleAddArea(siteId) {
    const parentSite = sites.find(s => s.id === siteId);
    if (!parentSite) return;

    const areaName = prompt('Enter new area name to add:');
    if (!areaName || !areaName.trim()) return;

    try {
      showToast('⏳ Adding area...');
      await api.post('/sites', {
        name: `${parentSite.location} — ${areaName.trim()}`,
        location: parentSite.location,
        gaName: parentSite.gaName,
        chargeArea: areaName.trim(),
        zone: parentSite.zone,
        district: parentSite.district
      });

      showToast('✓ Area added successfully');
      const res = await api.get('/sites');
      if (res.data?.success && res.data?.sites) {
        setSites(res.data.sites);
      }
    } catch (err) {
      console.error('Failed to add area:', err);
      showToast('❌ Failed to add area.');
    }
  }

  // ── Confirm Delete Action ──
  async function confirmDelete() {
    if (!deleteTarget) return;
    const { type, site } = deleteTarget;
    try {
      showToast(`⏳ Removing ${type}...`);
      if (type === 'Area') {
        await api.delete(`/sites/${site.id}`);
      } else if (type === 'City') {
        await api.delete(`/sites/city/${encodeURIComponent(site.gaName)}/${encodeURIComponent(site.location)}`);
      } else if (type === 'GA') {
        await api.delete(`/sites/ga/${encodeURIComponent(site.gaName)}`);
      }

      showToast(`✓ ${type} removed successfully`);
      setDeleteTarget(null);

      // Refresh sites
      const res = await api.get('/sites');
      if (res.data?.success && res.data?.sites) {
        setSites(res.data.sites);
      }
    } catch (error) {
      console.error('Failed to delete:', error);
      const msg = error.response?.data?.error || `Failed to delete ${type}`;
      showToast(`❌ ${msg}`);
      setDeleteTarget(null);
    }
  }
  async function handleAddArea() {
    try {
      await api.post('/sites', {
        name: `${parentSite.location} — ${areaName.trim()}`,
        location: parentSite.location,
        gaName: parentSite.gaName,
        chargeArea: areaName.trim(),
        zone: 'Zone 1',
        district: parentSite.location
      });

      showToast('✓ Area added successfully');
      const res = await api.get('/sites');
      if (res.data?.success && res.data?.sites) {
        setSites(res.data.sites);
      }
    } catch (err) {
      console.error('Failed to add area site:', err);
      showToast('❌ Failed to add area.');
    }
  }

  const handleSiteSelectChange = (userId, siteId) => {
    setSelectedSiteForUser(prev => ({
      ...prev,
      [userId]: siteId
    }));
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1f4e1a', margin: 0 }}>Access Management</h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>Manage user roles, site access, and permissions</p>
        </div>
      </div>

      {/* Non-blocking success banner */}
      {submittedMessage && (
        <div style={{
          background: '#d1fae5', color: '#166534',
          padding: '12px 16px', borderRadius: '6px',
          fontSize: '13px', fontWeight: 500,
          marginBottom: '16px', display: 'flex',
          alignItems: 'center', gap: '8px',
          border: '1px solid #6ee7b7',
        }}>
          ✓ {submittedMessage}
        </div>
      )}

      {/* Supervisor without access — Request panel (NOT shown to admins) */}
      {!isAdmin && (
        <div className="card" style={{ padding: 20, marginBottom: 20, border: '2px solid #fbbf24', background: '#fffbeb' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <span style={{ fontSize: 28 }}>🔐</span>
            <div style={{ flex: 1 }}>
              <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#92400e' }}>Request Site Access</p>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: '#78350f' }}>You currently have view-only access. Request access to edit a specific site.</p>
              <button onClick={() => { setRSite(allSiteNames[0] || ''); setShowModal(true); }}
                style={{ background: '#2d6a27', color: '#fff', border: 'none', borderRadius: 7, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Request Access to a Site
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Registered Users — ADMIN ONLY */}
      {isAdmin && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1f4e1a', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>👥</span> Registered Users
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 400, marginLeft: 4 }}>({usersList.length} total)</span>
          </h3>
          {usersList.map(u => (
            <div key={u.id || u.email} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: u.role === 'ADMIN' ? '#b91c1c' : u.role === 'WORKER' ? '#1d4ed8' : '#2d6a27', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                {u.name ? u.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U'}
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{u.name}</p>
                <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>
                  {u.email} · Assigned Sites: <strong>
                    {u.assignedSites && u.assignedSites.length > 0
                      ? u.assignedSites.map(as => as.site.name).join(', ')
                      : 'None'}
                  </strong>
                </p>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: u.role === 'ADMIN' ? '#fee2e2' : u.role === 'WORKER' ? '#dbeafe' : '#dcfce7', color: u.role === 'ADMIN' ? '#b91c1c' : u.role === 'WORKER' ? '#1d4ed8' : '#15803d' }}>
                {u.role}
              </span>

              {/* Site Assignment controls */}
              {isAdmin && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <select
                    value={selectedSiteForUser[u.id] || ''}
                    onChange={(e) => handleSiteSelectChange(u.id, e.target.value)}
                    style={{ fontSize: 11, padding: '4px 8px', borderRadius: 4, border: '1px solid #cbd5e1', background: 'white' }}
                  >
                    <option value="">Assign Site...</option>
                    {sites.map(s => (
                      <option key={s.id} value={s.id}>{s.name || s.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => assignUserToSite(u.id)}
                    style={{ background: '#2d6a27', color: 'white', border: 'none', padding: '4px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
                  >
                    Assign
                  </button>
                </div>
              )}

              {/* Remove button */}
              {isAdmin && u.email !== user?.email && !ADMIN_EMAILS.includes(u.email) && (
                <button onClick={() => removeUser(u.id, u.email)}
                  style={{ background: 'white', color: '#dc2626', border: '1px solid #dc2626', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', marginLeft: '8px' }}>
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deletePending && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 6000, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '28px 32px', maxWidth: 420, width: '100%', boxShadow: '0 20px 56px rgba(0,0,0,0.28)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <span style={{ fontSize: 32 }}>🗑️</span>
              <div>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>Delete GA Location?</p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>{deletePending.name}</p>
              </div>
            </div>
            <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, marginBottom: 24 }}>
              Are you sure you want to delete this GA Location? <strong>This cannot be undone.</strong> All associated records (connections, inventory, attendance, PE laying, meter registers, etc.) will also be permanently removed.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeletePending(null)}
                disabled={deleteLoading}
                style={{ padding: '9px 22px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#64748b', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleteLoading}
                style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: deleteLoading ? '#94a3b8' : '#dc2626', color: '#fff', fontWeight: 700, cursor: deleteLoading ? 'not-allowed' : 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {deleteLoading ? '⏳ Deleting...' : '🗑 Yes, Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Site Modal */}
      {editSite && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5500, padding: 16, overflowY: 'auto' }}
          onClick={e => e.target === e.currentTarget && !editSaving && setEditSite(null)}
        >
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 480, boxShadow: '0 20px 56px rgba(0,0,0,0.25)', overflow: 'hidden', margin: 'auto' }}>
            <div style={{ background: 'linear-gradient(90deg, #1f4e1a, #2d6a27)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>✏️ Edit Site Details</span>
              <button onClick={() => setEditSite(null)} disabled={editSaving}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Site Name *', key: 'name', placeholder: 'e.g. Dabwali — CA-09' },
                { label: 'GA Name *', key: 'gaName', placeholder: 'e.g. Sirsa', disabled: true },
                { label: 'City (Location)', key: 'location', placeholder: 'e.g. Dabwali' },
                { label: 'Charge Area', key: 'chargeArea', placeholder: 'e.g. Ward 1' },
                { label: 'Zone *', key: 'zone', placeholder: 'e.g. Zone 1' },
                { label: 'District *', key: 'district', placeholder: 'e.g. Sirsa' },
              ].map(({ label, key, placeholder, disabled }) => (
                <div key={key}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>{label}</label>
                  <input
                    value={editForm[key] || ''}
                    onChange={e => !disabled && setEditForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    readOnly={disabled}
                    style={{ width: '100%', height: 36, border: '1px solid #d1d5db', borderRadius: 6, padding: '0 10px', fontSize: 13, boxSizing: 'border-box', background: disabled ? '#f1f5f9' : '#fff', color: disabled ? '#94a3b8' : '#1e293b', outline: 'none' }}
                    onFocus={e => { if (!disabled) e.target.style.borderColor = '#2d6a27'; }}
                    onBlur={e => e.target.style.borderColor = '#d1d5db'}
                  />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Status</label>
                <select
                  value={editForm.status || 'Active'}
                  onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                  style={{ width: 140, height: 36, border: '1px solid #d1d5db', borderRadius: 6, padding: '0 10px', fontSize: 13, background: '#fff', outline: 'none' }}
                >
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button onClick={() => setEditSite(null)} disabled={editSaving}
                  style={{ flex: 1, height: 38, background: '#f1f5f9', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
                  Cancel
                </button>
                <button onClick={handleEditSave} disabled={editSaving}
                  style={{ flex: 1, height: 38, background: editSaving ? '#94a3b8' : '#2d6a27', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: editSaving ? 'not-allowed' : 'pointer', color: '#fff' }}>
                  {editSaving ? '⏳ Saving...' : '✓ Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GA Locations & Sites — ADMIN ONLY */}
      {isAdmin && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1f4e1a', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>📍</span> GA Locations &amp; Sites
            </h3>
            <button onClick={() => setShowLocModal(true)}
              style={{ background: '#2d6a27', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              + Add New GA Location
            </button>
          </div>
          {sites.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8', fontSize: 13 }}>
              No GA Locations or Sites found. Click &quot;+ Add New GA Location&quot; to get started.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {sites.map(s => (
                <div key={s.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {/* Card header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1f4e1a', lineHeight: 1.4, flex: 1, marginRight: 8 }}>{s.name}</p>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: s.status === 'Active' ? '#dcfce7' : '#fee2e2', color: s.status === 'Active' ? '#15803d' : '#b91c1c', flexShrink: 0 }}>
                      {s.status}
                    </span>
                  </div>

                  {/* GA info only — no City/Area displayed */}
                  <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>GA: <strong>{s.gaName || '—'}</strong></p>
                  {s.zone && <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>Zone: {s.zone} · District: {s.district || '—'}</p>}

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                    <button
                      id={`edit-site-${s.id}`}
                      onClick={() => openEditModal(s)}
                      style={{ flex: 1, height: 30, background: '#fff', color: '#2d6a27', border: '1.5px solid #2d6a27', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'}
                      onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                    >
                      ✏️ Edit Details
                    </button>
                    <button
                      id={`delete-site-${s.id}`}
                      onClick={() => setDeletePending(s)}
                      title="Delete this GA Location"
                      style={{ width: 30, height: 30, background: '#fff', color: '#dc2626', border: '1.5px solid #fecaca', borderRadius: 6, fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.borderColor = '#dc2626'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#fecaca'; }}
                    >
                      🗑
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <button
                      onClick={() => setDeleteTarget({ type: 'City', site: s })}
                      style={{ flex: 1, height: 28, background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                    >
                      Remove City
                    </button>
                    <button
                      onClick={() => setDeleteTarget({ type: 'Area', site: s })}
                      style={{ flex: 1, height: 28, background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                    >
                      Remove Area
                    </button>
                  </div>
                  <div style={{ display: 'flex', marginTop: 6 }}>
                    <button
                      onClick={() => setDeleteTarget({ type: 'GA', site: s })}
                      style={{ width: '100%', height: 28, background: '#991b1b', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                    >
                      Remove GA Location
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Info bar */}
      <div style={{ background: '#dbeafe', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 16px', fontSize: 12, color: '#1e40af', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <span>ℹ️</span>
        Role-based access control (RBAC) and site assignment is enforced dynamically via the backend.
      </div>

      {/* ── Request Access Modal — conditionally rendered ── */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ background: '#1f4e1a', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>Request Site Editing Access</span>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Your Name</label>
                  <input value={rName} onChange={e => setRName(e.target.value)}
                    style={{ width: '100%', height: 34, border: '1px solid #d1d5db', borderRadius: 5, padding: '0 10px', fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Your Email</label>
                  <input value={rEmail} readOnly
                    style={{ width: '100%', height: 34, border: '1px solid #d1d5db', borderRadius: 5, padding: '0 10px', fontSize: 13, boxSizing: 'border-box', background: '#f8fafc', color: '#94a3b8' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Select Site</label>
                  {allSiteNames.length > 0 ? (
                    <select value={rSite} onChange={e => setRSite(e.target.value)}
                      style={{ width: '100%', height: 34, border: '1px solid #d1d5db', borderRadius: 5, padding: '0 10px', fontSize: 13, boxSizing: 'border-box', background: '#fff' }}>
                      {allSiteNames.map(s => <option key={s}>{s}</option>)}
                    </select>
                  ) : (
                    <>
                      <input
                        value={rSite}
                        onChange={e => setRSite(e.target.value)}
                        placeholder="Type the site / location name"
                        style={{ width: '100%', height: 34, border: '1px solid #d1d5db', borderRadius: 5, padding: '0 10px', fontSize: 13, boxSizing: 'border-box' }}
                      />
                      <p style={{ margin: '4px 0 0', fontSize: 11, color: '#94a3b8' }}>
                        No GA locations have been added yet. You can type the site name to request access.
                      </p>
                    </>
                  )}
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Reason (optional)</label>
                  <textarea value={rReason} onChange={e => setRReason(e.target.value)}
                    placeholder="e.g. I am the supervisor for this site" rows={3}
                    style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 5, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box', resize: 'vertical' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button onClick={() => setShowModal(false)}
                  style={{ flex: 1, height: 38, background: '#f1f5f9', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
                  Cancel
                </button>
                <button onClick={handleSubmitRequest}
                  disabled={!rName.trim() || !rSite}
                  style={{ flex: 1, height: 38, background: (!rName.trim() || !rSite) ? '#94a3b8' : '#2d6a27', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: (!rName.trim() || !rSite) ? 'not-allowed' : 'pointer', color: '#fff' }}>
                  Submit Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add GA Location Modal ── */}
      {showLocModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden', margin: 'auto' }}>
            <div style={{ background: '#1f4e1a', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>Add New GA Location</span>
              <button onClick={() => setShowLocModal(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '75vh', overflowY: 'auto' }}>
              {/* GA Location Name */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>GA Location Name *</label>
                <input value={locName} onChange={e => setLocName(e.target.value)}
                  placeholder="e.g. Sirsa"
                  style={{ width: '100%', height: 34, border: '1px solid #d1d5db', borderRadius: 5, padding: '0 10px', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              {/* Status */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Status</label>
                <select value={locStatus} onChange={e => setLocStatus(e.target.value)}
                  style={{ width: 140, height: 34, border: '1px solid #d1d5db', borderRadius: 5, padding: '0 10px', fontSize: 13, background: '#fff' }}>
                  <option>Active</option><option>Inactive</option>
                </select>
              </div>
              {/* Cities section */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#1f4e1a', textTransform: 'uppercase', letterSpacing: 0.5 }}>Cities under this GA Location</label>
                  <button type="button" onClick={addCityRow}
                    style={{ fontSize: 12, fontWeight: 600, color: '#2d6a27', background: '#f0f7ee', border: '1px dashed #2d6a27', borderRadius: 4, padding: '4px 10px', cursor: 'pointer' }}>
                    + Add Another City
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {locCities.map((city, idx) => (
                    <div key={idx} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px', background: '#f8fafc', position: 'relative' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>City {idx + 1}</span>
                        {locCities.length > 1 && (
                          <button type="button" onClick={() => removeCityRow(idx)}
                            style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 4, width: 24, height: 24, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 3 }}>City Name *</label>
                          <input value={city.cityName} onChange={e => updateCityRow(idx, 'cityName', e.target.value)}
                            placeholder="e.g. Dabwali"
                            style={{ width: '100%', height: 32, border: '1px solid #d1d5db', borderRadius: 4, padding: '0 8px', fontSize: 12, boxSizing: 'border-box' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 3 }}>Areas (comma-separated)</label>
                          <input value={city.areasText} onChange={e => updateCityRow(idx, 'areasText', e.target.value)}
                            placeholder="e.g. Ward 1, Ward 2, Main Market"
                            style={{ width: '100%', height: 32, border: '1px solid #d1d5db', borderRadius: 4, padding: '0 8px', fontSize: 12, boxSizing: 'border-box' }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowLocModal(false)}
                  style={{ flex: 1, height: 38, background: '#f1f5f9', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
                  Cancel
                </button>
                <button onClick={handleAddLocation}
                  style={{ flex: 1, height: 38, background: '#2d6a27', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#fff' }}>
                  Add Location
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteTarget(null); }}>
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ background: '#dc2626', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>Confirm Removal</span>
              <button onClick={() => setDeleteTarget(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: 24 }}>
              <p style={{ margin: '0 0 12px', fontSize: 14, color: '#374151', lineHeight: 1.5 }}>
                Are you sure you want to remove this <strong>{deleteTarget.type}</strong>?
              </p>

              {deleteTarget.type === 'Area' && (
                <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>
                  This will remove the Area: <br /><strong style={{ color: '#1e293b' }}>{deleteTarget.site.chargeArea}</strong>
                </p>
              )}
              {deleteTarget.type === 'City' && (
                <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>
                  This will remove the City and ALL its Areas: <br /><strong style={{ color: '#1e293b' }}>{deleteTarget.site.location}</strong>
                </p>
              )}
              {deleteTarget.type === 'GA' && (
                <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, padding: 12, marginBottom: 16 }}>
                  <p style={{ margin: 0, fontSize: 13, color: '#991b1b', fontWeight: 600 }}>
                    ⚠️ WARNING: DANGER ZONE
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#991b1b' }}>
                    This will permanently delete the ENTIRE GA Location (<strong style={{ color: '#7f1d1d' }}>{deleteTarget.site.gaName}</strong>) including all its Cities, Areas, and assigned users.
                  </p>
                </div>
              )}

              <p style={{ margin: '0 0 20px', fontSize: 13, color: '#dc2626', fontWeight: 600 }}>
                This action cannot be undone.
              </p>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setDeleteTarget(null)}
                  style={{ flex: 1, height: 38, background: '#f1f5f9', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
                  Cancel
                </button>
                <button onClick={confirmDelete}
                  style={{ flex: 1, height: 38, background: '#dc2626', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#fff' }}>
                  Yes, Remove {deleteTarget.type}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
