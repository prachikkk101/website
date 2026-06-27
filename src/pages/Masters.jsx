// src/pages/Masters.jsx
import { useState, useEffect, useCallback } from 'react';
import { authService } from '../api/authService';
import { adminService } from '../api/adminService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { resetAllLocalData } from '../utils/dataService';

const LOCAL_SITES_FALLBACK = [
  { id: 'local-site-1', name: 'Khanna — CA-09',  users: [] },
  { id: 'local-site-2', name: 'UE-II — Hisar',   users: [] },
  { id: 'local-site-3', name: 'PLA — Hisar',     users: [] },
  { id: 'local-site-4', name: 'Kohara — CA-07',  users: [] },
];

/* ──────────────────────────────────────
   Shared helpers
────────────────────────────────────── */
function formatDate(str) {
  if (!str) return '—';
  const d = new Date(str);
  return isNaN(d) ? str : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5000, padding: 16,
    }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: '28px 32px', maxWidth: 380, width: '100%', boxShadow: '0 20px 48px rgba(0,0,0,0.25)' }}>
        <p style={{ fontSize: 16, fontWeight: 600, color: '#1e293b', marginBottom: 20, lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '8px 20px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', color: '#64748b', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Cancel</button>
          <button onClick={onConfirm} style={{ padding: '8px 20px', borderRadius: 7, border: 'none', background: '#c0440a', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>Yes, Confirm</button>
        </div>
      </div>
    </div>
  );
}

function AssignUserModal({ site, onClose, onSuccess }) {
  const [email, setEmail]   = useState('');
  const [role, setRole]     = useState('WORKER');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email) { setError('Email is required.'); return; }
    setError('');
    setLoading(true);
    try {
      await adminService.assignUserToSite(site.id, { email, role });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to assign user.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5000, padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 12, padding: '24px', maxWidth: 380, width: '100%', boxShadow: '0 16px 40px rgba(0,0,0,0.2)' }}>
        <h3 style={{ margin: '0 0 4px', color: '#1f4e1a', fontSize: 16, fontWeight: 700 }}>Assign Existing User</h3>
        <p style={{ margin: '0 0 20px', fontSize: 12, color: '#64748b' }}>Assign an already-registered user to <strong>{site.name}</strong></p>
        {error && <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '8px 12px', borderRadius: 7, fontSize: 12, marginBottom: 12 }}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>User Email *</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" required
              style={{ width: '100%', height: 40, border: '1px solid #d1d5db', borderRadius: 8, padding: '0 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => e.target.style.borderColor = '#2d6a27'}
              onBlur={e => e.target.style.borderColor = '#d1d5db'} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Role</label>
            <select value={role} onChange={e => setRole(e.target.value)}
              style={{ width: '100%', height: 40, border: '1px solid #d1d5db', borderRadius: 8, padding: '0 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#fff', cursor: 'pointer' }}>
              <option value="SUPERVISOR">Supervisor</option>
              <option value="WORKER">Worker</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, height: 38, border: '1px solid #d1d5db', background: '#fff', color: '#64748b', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={loading}
              style={{ flex: 1, height: 38, background: '#2d6a27', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Assigning...' : 'Assign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────
   TAB 1 — Access Requests
────────────────────────────────────── */
function AccessRequestsTab({ onCountChange }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const { showToast }           = useToast();
  const { refreshPendingCount } = useAuth();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await authService.getAccessRequests('pending');
      const list = Array.isArray(data) ? data : (data.requests || data.accessRequests || []);
      setRequests(list);
      onCountChange(list.length);
    } catch (err) {
      setError(err.response?.status === 403
        ? 'Access denied — admin only.'
        : 'Failed to load access requests. Backend may be offline.');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [onCountChange]);

  useEffect(() => { load(); }, [load]);

  async function handleApprove(req) {
    try {
      await authService.approveAccess({ requestId: req.id, siteId: req.siteId, role: req.role });
      setRequests(r => r.filter(x => x.id !== req.id));
      onCountChange(c => Math.max(0, c - 1));
      refreshPendingCount();
      showToast('✅ Access approved — user can now log in');
    } catch (err) {
      showToast('❌ ' + (err.response?.data?.error || 'Failed to approve'));
    }
  }

  async function handleReject(req) {
    try {
      await authService.rejectAccess(req.id);
      setRequests(r => r.filter(x => x.id !== req.id));
      onCountChange(c => Math.max(0, c - 1));
      refreshPendingCount();
      showToast('Request rejected');
    } catch (err) {
      showToast('❌ ' + (err.response?.data?.error || 'Failed to reject'));
    }
  }

  const thStyle = { padding: '10px 12px', fontSize: 11, fontWeight: 700, color: '#64748b', textAlign: 'left', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' };
  const tdStyle = { padding: '12px 12px', fontSize: 13, color: '#1e293b', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
      <div style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#2d6a27', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );

  if (error) return (
    <div style={{ padding: 32, textAlign: 'center', color: '#b91c1c', background: '#fee2e2', borderRadius: 8, margin: 16 }}>⚠️ {error}</div>
  );

  if (requests.length === 0) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
      <p style={{ fontSize: 15, fontWeight: 600, margin: '0 0 4px' }}>No pending access requests</p>
      <p style={{ fontSize: 13, margin: 0 }}>New requests will appear here</p>
    </div>
  );

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {['Name', 'Email', 'Phone', 'Requested Site', 'Role', 'Requested At', 'Action'].map(h => (
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {requests.map(req => (
            <tr key={req.id} style={{ transition: 'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.background = ''}>
              <td style={tdStyle}><strong>{req.name || req.fullName || '—'}</strong></td>
              <td style={tdStyle}>{req.email || '—'}</td>
              <td style={tdStyle}>{req.phone || '—'}</td>
              <td style={tdStyle}>{req.site?.name || req.siteName || '—'}</td>
              <td style={tdStyle}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: req.role === 'SUPERVISOR' ? '#dbeafe' : '#dcfce7', color: req.role === 'SUPERVISOR' ? '#1d4ed8' : '#15803d' }}>
                  {req.role || '—'}
                </span>
              </td>
              <td style={{ ...tdStyle, color: '#64748b', fontSize: 12 }}>{formatDate(req.createdAt || req.requestedAt)}</td>
              <td style={tdStyle}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => handleApprove(req)}
                    style={{ height: 30, padding: '0 12px', background: '#2d6a27', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                    onMouseEnter={e => e.target.style.background = '#1f4e1a'}
                    onMouseLeave={e => e.target.style.background = '#2d6a27'}
                  >✓ Approve</button>
                  <button
                    onClick={() => handleReject(req)}
                    style={{ height: 30, padding: '0 12px', background: '#fff', color: '#c0440a', border: '1.5px solid #c0440a', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                    onMouseEnter={e => { e.target.style.background = '#fee2e2'; }}
                    onMouseLeave={e => { e.target.style.background = '#fff'; }}
                  >✗ Reject</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ──────────────────────────────────────
   TAB 2 — Site Access Management
────────────────────────────────────── */
function SiteAccessTab() {
  const [sites, setSites]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [confirm, setConfirm]       = useState(null);   // { userId, userName, siteId, siteName, action }
  const [assignModal, setAssignModal] = useState(null); // site object
  const { showToast }               = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminService.getSiteUsers();
      const list = Array.isArray(data) ? data : (data.sites || []);
      setSites(list.length > 0 ? list : LOCAL_SITES_FALLBACK);
    } catch {
      // Backend offline — show local sites with no users
      setSites(LOCAL_SITES_FALLBACK);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function askConfirm(userId, userName, siteId, siteName, action) {
    setConfirm({ userId, userName, siteId, siteName, action });
  }

  async function handleConfirm() {
    const { userId, userName, siteName, action } = confirm;
    setConfirm(null);
    try {
      if (action === 'restrict') {
        await adminService.restrictUser(userId);
        showToast(`Access restricted for ${userName}`);
      } else {
        await adminService.restoreUser(userId);
        showToast(`Access restored for ${userName}`);
      }
      load();
    } catch (err) {
      showToast('❌ ' + (err.response?.data?.error || 'Action failed'));
    }
  }

  const thStyle = { padding: '9px 12px', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.8)', textAlign: 'left', whiteSpace: 'nowrap' };
  const tdStyle = { padding: '11px 12px', fontSize: 13, color: '#1e293b', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
      <div style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#2d6a27', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );

  if (error) return (
    <div style={{ padding: 32, textAlign: 'center', color: '#b91c1c', background: '#fee2e2', borderRadius: 8, margin: 16 }}>⚠️ {error}</div>
  );

  return (
    <>
      {confirm && (
        <ConfirmDialog
          message={
            confirm.action === 'restrict'
              ? `Are you sure you want to restrict ${confirm.userName}'s access to ${confirm.siteName}? They will not be able to log in.`
              : `Restore access for ${confirm.userName} to ${confirm.siteName}?`
          }
          onConfirm={handleConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
      {assignModal && (
        <AssignUserModal
          site={assignModal}
          onClose={() => setAssignModal(null)}
          onSuccess={() => { setAssignModal(null); load(); showToast('User assigned successfully'); }}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {sites.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: '#94a3b8' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🏗️</div>
            <p style={{ fontSize: 14, fontWeight: 600 }}>No sites found</p>
          </div>
        )}
        {sites.map(site => {
          const workers = site.workers || site.users || [];
          return (
            <div key={site.id} className="card" style={{ overflow: 'hidden' }}>
              {/* Site card header */}
              <div style={{ background: 'linear-gradient(90deg, #1f4e1a, #2d6a27)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ margin: 0, color: '#fff', fontWeight: 700, fontSize: 15 }}>{site.name}</p>
                  {site.location && <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>{site.location}</p>}
                </div>
                <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.15)', color: '#fff', borderRadius: 5, padding: '3px 10px', fontWeight: 600 }}>
                  {workers.length} user{workers.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Users table */}
              {workers.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        {['Name', 'Email', 'Role', 'Status', 'Action'].map(h => (
                          <th key={h} style={{ ...thStyle, color: '#64748b' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {workers.map(worker => {
                        const isActive = (worker.status || 'ACTIVE').toUpperCase() !== 'RESTRICTED';
                        return (
                          <tr key={worker.id}
                            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                            onMouseLeave={e => e.currentTarget.style.background = ''}>
                            <td style={tdStyle}><strong>{worker.name || '—'}</strong></td>
                            <td style={{ ...tdStyle, color: '#64748b' }}>{worker.email || '—'}</td>
                            <td style={tdStyle}>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: worker.role === 'SUPERVISOR' ? '#dbeafe' : '#dcfce7', color: worker.role === 'SUPERVISOR' ? '#1d4ed8' : '#15803d' }}>
                                {worker.role || '—'}
                              </span>
                            </td>
                            <td style={tdStyle}>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: isActive ? '#dcfce7' : '#fee2e2', color: isActive ? '#15803d' : '#b91c1c' }}>
                                {isActive ? 'Active' : 'Restricted'}
                              </span>
                            </td>
                            <td style={tdStyle}>
                              {isActive ? (
                                <button
                                  onClick={() => askConfirm(worker.id, worker.name, site.id, site.name, 'restrict')}
                                  style={{ height: 30, padding: '0 12px', background: '#fff', color: '#c0440a', border: '1.5px solid #c0440a', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                  onMouseEnter={e => e.target.style.background = '#fee2e2'}
                                  onMouseLeave={e => e.target.style.background = '#fff'}
                                >Restrict Access</button>
                              ) : (
                                <button
                                  onClick={() => askConfirm(worker.id, worker.name, site.id, site.name, 'restore')}
                                  style={{ height: 30, padding: '0 12px', background: '#fff', color: '#2d6a27', border: '1.5px solid #2d6a27', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                  onMouseEnter={e => e.target.style.background = '#dcfce7'}
                                  onMouseLeave={e => e.target.style.background = '#fff'}
                                >Restore Access</button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ padding: '16px', color: '#94a3b8', fontSize: 13, textAlign: 'center', margin: 0 }}>No users assigned to this site yet.</p>
              )}

              {/* Assign user */}
              <div style={{ padding: '10px 16px', borderTop: '1px solid #f1f5f9', background: '#fafafa' }}>
                <button
                  onClick={() => setAssignModal(site)}
                  style={{ height: 32, padding: '0 14px', background: '#fff', color: '#2d6a27', border: '1.5px solid #2d6a27', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'}
                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                >
                  <span style={{ fontSize: 14 }}>+</span> Assign Existing User
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ──────────────────────────────────────
   MAIN Masters Page
────────────────────────────────────── */
export default function Masters({ defaultTab }) {
  const [activeTab, setActiveTab]       = useState(defaultTab === 'access-requests' ? 0 : 0);
  const [pendingCount, setPendingCount] = useState(0);
  const [resetConfirm, setResetConfirm] = useState(false);
  const { user }                        = useAuth();

  // Only admins should land here — ProtectedRoute handles redirect
  if (user && user.role !== 'ADMIN') {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
        <p style={{ fontSize: 40 }}>🚫</p>
        <p>Admin access only.</p>
      </div>
    );
  }

  const tabs = [
    { label: 'Access Requests', badge: pendingCount },
    { label: 'Site Access Management', badge: 0 },
  ];

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Tab header */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e2e8f0', marginBottom: 20 }}>
        {tabs.map((tab, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i)}
            style={{
              position: 'relative',
              padding: '12px 24px',
              border: 'none',
              background: 'transparent',
              fontSize: 14,
              fontWeight: activeTab === i ? 700 : 500,
              color: activeTab === i ? '#1f4e1a' : '#64748b',
              cursor: 'pointer',
              borderBottom: activeTab === i ? '2px solid #2d6a27' : '2px solid transparent',
              marginBottom: -2,
              transition: 'color 0.15s',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {tab.label}
            {tab.badge > 0 && (
              <span style={{
                background: '#f97316', color: '#fff', borderRadius: 10, fontSize: 10,
                fontWeight: 800, padding: '1px 6px', minWidth: 18, textAlign: 'center', lineHeight: 1.6,
              }}>
                {tab.badge > 99 ? '99+' : tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="card" style={{ overflow: 'visible' }}>
        {activeTab === 0 && (
          <AccessRequestsTab onCountChange={setPendingCount} />
        )}
        {activeTab === 1 && (
          <SiteAccessTab />
        )}
      </div>

      {/* ── Dev utility: Reset All Local Data ── */}
      <div style={{ marginTop: 40, paddingTop: 20, borderTop: '1px dashed #e2e8f0', textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10, fontStyle: 'italic' }}>Development only — removes all local entries</p>
        {!resetConfirm ? (
          <button
            onClick={() => setResetConfirm(true)}
            style={{ height: 32, padding: '0 16px', background: '#fff', color: '#b91c1c', border: '1.5px solid #b91c1c', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            onMouseEnter={e => e.target.style.background = '#fee2e2'}
            onMouseLeave={e => e.target.style.background = '#fff'}
          >
            🗑 Reset All Local Data
          </button>
        ) : (
          <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 10, padding: '14px 20px' }}>
            <p style={{ margin: 0, fontSize: 12, color: '#b91c1c', fontWeight: 600 }}>This will delete all locally stored entries and reset to demo data. Are you sure?</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setResetConfirm(false)} style={{ height: 30, padding: '0 14px', border: '1px solid #d1d5db', background: '#fff', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#64748b' }}>Cancel</button>
              <button
                onClick={() => { resetAllLocalData(); window.location.reload(); }}
                style={{ height: 30, padding: '0 14px', background: '#b91c1c', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >Yes, Reset Everything</button>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
