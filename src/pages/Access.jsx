// src/pages/Access.jsx
import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useToast } from '../components/Toast';

function getSites() {
  try {
    const raw = localStorage.getItem('gppms_sites');
    if (!raw) return [];
    return JSON.parse(raw);
  } catch { return []; }
}

function getSession() {
  try { return JSON.parse(localStorage.getItem('gppms_session') || '{}'); } catch { return {}; }
}
function getRequests() {
  try { return JSON.parse(localStorage.getItem('gppms_access_requests') || '[]'); } catch { return []; }
}
function saveRequests(reqs) { localStorage.setItem('gppms_access_requests', JSON.stringify(reqs)); }
function fmtDate(iso) {
  try { return new Date(iso).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }); }
  catch { return iso; }
}

const ADMIN_EMAILS = ['admin@gppms.com', 'oxygenhisar@gmail.com', 'oxygenprotech@gmail.com'];

export default function Access() {
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();
  const navigate = useNavigate();

  const session    = getSession();
  const isAdmin    = (
    user?.role === 'ADMIN' || user?.role === 'admin' ||
    ['oxygenhisar@gmail.com', 'oxygenprotech@gmail.com', 'admin@gppms.com']
      .includes((session.email || '').toLowerCase())
  );
  const isSupervisor = user?.role === 'SUPERVISOR';
  const siteAccess   = session.siteAccess;
  const isViewOnly   = !isAdmin && (!siteAccess || siteAccess === 'none' || siteAccess === null);

  const [requests,  setRequests]  = useState([]);
  const [sites,     setSites]     = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedMessage, setSubmittedMessage] = useState('');

  // GA Location form state — 3-level
  const [showLocModal, setShowLocModal] = useState(false);
  const [locName,      setLocName]      = useState('');
  const [locStatus,    setLocStatus]    = useState('Active');
  // Cities array: [{ cityName: '', areasText: '' }]
  const [locCities, setLocCities] = useState([{ cityName: '', areasText: '' }]);

  function addCityRow() {
    setLocCities(prev => [...prev, { cityName: '', areasText: '' }]);
  }
  function removeCityRow(idx) {
    setLocCities(prev => prev.filter((_, i) => i !== idx));
  }
  function updateCityRow(idx, field, val) {
    setLocCities(prev => prev.map((c, i) => i === idx ? { ...c, [field]: val } : c));
  }

  // Request form state
  const [rName,   setRName]   = useState(session.name  || '');
  const [rEmail,  setREmail]  = useState(session.email || '');
  const [rSite,   setRSite]   = useState('');
  const [rReason, setRReason] = useState('');

  useEffect(() => {
    document.title = 'GP-PMS \u2014 Access Management';
    setRequests(getRequests());
    setSites(getSites());
  }, []);

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const allSiteNames    = sites.map(s => s.name);

  // ── Request Access ──
  function handleSubmitRequest() {
    if (!rName.trim() || !rSite) return;
    const newReq = { id: Date.now(), name: rName, email: rEmail, site: rSite, reason: rReason, status: 'pending', requestedAt: new Date().toISOString() };
    const updated = [...requests, newReq];
    setRequests(updated); saveRequests(updated);
    // CRITICAL: close the modal immediately
    setShowModal(false);
    setSubmitted(false);
    // Show inline non-blocking banner on the page
    setSubmittedMessage('Request sent — waiting for admin approval. You can continue browsing in view-only mode.');
    // Auto-clear after 6 seconds
    setTimeout(() => setSubmittedMessage(''), 6000);
  }

  // ── Approve / Reject ──
  function approveRequest(id) {
    const req = requests.find(r => r.id === id);
    const updated = requests.map(r => r.id === id ? { ...r, status: 'approved' } : r);
    setRequests(updated); saveRequests(updated);
    try {
      const users = JSON.parse(localStorage.getItem('gppms_users') || '[]');
      const upd = users.find(u => u.email === req?.email)
        ? users.map(u => u.email === req?.email ? { ...u, siteAccess: req.site } : u)
        : [...users, { email: req?.email, siteAccess: req?.site }];
      localStorage.setItem('gppms_users', JSON.stringify(upd));
    } catch {}
    showToast('\u2713 Access granted to ' + (req?.name || 'user'));
  }

  function rejectRequest(id) {
    const updated = requests.map(r => r.id === id ? { ...r, status: 'rejected' } : r);
    setRequests(updated); saveRequests(updated);
    showToast('Request rejected');
  }

  // ── Remove User ──
  function removeUser(email) {
    const first = window.confirm(`Remove ${email} from the system?\n\nThis will revoke their access completely.`);
    if (!first) return;
    const second = window.confirm(`FINAL CONFIRMATION\n\nAre you absolutely sure you want to permanently remove ${email}?\n\nThis cannot be undone.`);
    if (!second) return;
    try {
      const users = JSON.parse(localStorage.getItem('gppms_users') || '[]');
      localStorage.setItem('gppms_users', JSON.stringify(users.filter(u => u.email !== email)));
      const reqs = JSON.parse(localStorage.getItem('gppms_access_requests') || '[]');
      const updatedReqs = reqs.filter(r => r.email !== email);
      setRequests(updatedReqs); saveRequests(updatedReqs);
    } catch {}
    showToast(`${email} has been removed`);
  }

  // ── Add GA Location (3-level) ──
  function handleAddLocation() {
    if (!locName.trim()) { showToast('\u26a0 Location name is required'); return; }
    const citiesBuilt = locCities
      .filter(c => c.cityName.trim())
      .map((c, i) => ({
        id: 'city_' + Date.now() + '_' + i,
        label: c.cityName.trim(),
        areas: c.areasText.split(',').map(a => a.trim()).filter(Boolean),
      }));
    if (citiesBuilt.length === 0) { showToast('\u26a0 Add at least one city'); return; }
    const newSite = {
      id: 'site_' + Date.now(),
      name: locName.trim(),
      label: locName.trim(),
      cities: citiesBuilt,
      // Flattened areas for backward compat
      areas: citiesBuilt.flatMap(c => c.areas),
      status: locStatus,
      createdAt: new Date().toISOString(),
      createdBy: session.name || 'Admin',
    };
    const updated = [...sites, newSite];
    setSites(updated);
    localStorage.setItem('gppms_sites', JSON.stringify(updated));
    window.dispatchEvent(new Event('storage'));
    setShowLocModal(false);
    setLocName('');
    setLocStatus('Active');
    setLocCities([{ cityName: '', areasText: '' }]);
    showToast('\u2713 GA Location added \u2014 ' + newSite.name);
  }

  // ── Add City to existing site ──
  function handleAddCity(siteId) {
    const cityName = prompt('Enter new city name to add to this GA location:');
    if (!cityName || !cityName.trim()) return;
    const areasInput = prompt('Enter areas for this city (comma-separated, optional):') || '';
    const newCity = {
      id: 'city_' + Date.now(),
      label: cityName.trim(),
      areas: areasInput.split(',').map(a => a.trim()).filter(Boolean)
    };

    const updated = sites.map(s => {
      if (s.id === siteId) {
        const updatedCities = [...(s.cities || []), newCity];
        return {
          ...s,
          cities: updatedCities,
          areas: [...(s.areas || []), ...newCity.areas]
        };
      }
      return s;
    });

    setSites(updated);
    localStorage.setItem('gppms_sites', JSON.stringify(updated));
    window.dispatchEvent(new Event('storage'));
    showToast(`✓ City "${cityName.trim()}" added to location`);
  }

  // ── Add Area to existing site ──
  function handleAddArea(siteId) {
    const areaName = prompt('Enter new area name to add to this location:');
    if (!areaName || !areaName.trim()) return;
    const updated = sites.map(s =>
      s.id === siteId
        ? { ...s, areas: [...(s.areas || []), areaName.trim()] }
        : s
    );
    setSites(updated);
    localStorage.setItem('gppms_sites', JSON.stringify(updated));
    window.dispatchEvent(new Event('storage'));
    showToast('\u2713 Area "' + areaName.trim() + '" added');
  }

  // ── Remove one Area from GA Location ──
  function handleRemoveArea(siteId, areaName) {
    const updated = sites.map(s =>
      s.id === siteId
        ? { ...s, areas: (s.areas || []).filter(a => a !== areaName) }
        : s
    );
    setSites(updated);
    localStorage.setItem('gppms_sites', JSON.stringify(updated));
    window.dispatchEvent(new Event('storage'));
    showToast('\u2713 Area "' + areaName + '" removed');
  }

  // ── Remove GA Location ──
  function handleRemoveSite(siteId, siteName) {
    if (!window.confirm(`Remove "${siteName}" from GA Locations?\n\nThis will remove the location and all its areas.`)) return;
    const updated = sites.filter(s => s.id !== siteId);
    setSites(updated);
    localStorage.setItem('gppms_sites', JSON.stringify(updated));
    window.dispatchEvent(new Event('storage'));
    showToast('\u2713 Location removed');
  }

  // Registered users — hardcoded admins + approved access requests
  const baseUsers = [
    { name: 'Admin',          email: 'admin@gppms.com',           role: 'ADMIN',      site: 'All Sites' },
    { name: 'Oxygen Hisar',   email: 'oxygenhisar@gmail.com',     role: 'ADMIN',      site: 'All Sites' },
    { name: 'Oxygen Protech', email: 'oxygenprotech@gmail.com',   role: 'ADMIN',      site: 'All Sites' },
  ];
  // Merge in approved workers from request history
  const approvedWorkers = requests
    .filter(r => r.status === 'approved')
    .reduce((acc, r) => {
      // Avoid duplicates by email
      if (!acc.find(u => u.email === r.email) && !baseUsers.find(u => u.email === r.email)) {
        acc.push({ name: r.name, email: r.email, role: 'WORKER', site: r.site, approvedAt: r.requestedAt });
      }
      return acc;
    }, []);
  const allRegisteredUsers = [...baseUsers, ...approvedWorkers];

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'#1f4e1a', margin:0 }}>Access Management</h1>
          <p style={{ fontSize:13, color:'#64748b', margin:'4px 0 0' }}>Manage user roles, site access, and permissions</p>
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
        <div className="card" style={{ padding:20, marginBottom:20, border:'2px solid #fbbf24', background:'#fffbeb' }}>
          <div style={{ display:'flex', alignItems:'flex-start', gap:16 }}>
            <span style={{ fontSize:28 }}>🔐</span>
            <div style={{ flex:1 }}>
              <p style={{ margin:'0 0 4px', fontSize:15, fontWeight:700, color:'#92400e' }}>Request Site Access</p>
              <p style={{ margin:'0 0 12px', fontSize:13, color:'#78350f' }}>You currently have view-only access. Request access to edit a specific site.</p>
              <button onClick={() => { setSubmitted(false); setRSite(allSiteNames[0] || ''); setShowModal(true); }}
                style={{ background:'#2d6a27', color:'#fff', border:'none', borderRadius:7, padding:'9px 20px', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                Request Access to a Site
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin — Pending Requests */}
      {isAdmin && (
        <div className="card section-block" style={{ padding:20, marginBottom:20 }}>
          <h3 style={{ fontSize:15, fontWeight:700, color:'#c0440a', margin:'0 0 14px', display:'flex', alignItems:'center', gap:8 }}>
            Pending Access Requests
            {pendingRequests.length > 0 && (
              <span style={{ background:'#c0440a', color:'#fff', borderRadius:'50%', width:20, height:20, fontSize:11, display:'inline-flex', alignItems:'center', justifyContent:'center' }}>
                {pendingRequests.length}
              </span>
            )}
          </h3>

          {pendingRequests.length === 0 ? (
            <div style={{ textAlign:'center', padding:'24px', color:'#94a3b8', fontSize:13 }}>
              ✓ No pending access requests
            </div>
          ) : pendingRequests.map(req => (
            <div key={req.id} style={{ border:'1px solid #fde68a', borderRadius:8, padding:'14px 16px', marginBottom:10, background:'#fffbeb' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:10 }}>
                <div>
                  <p style={{ margin:0, fontSize:14, fontWeight:700, color:'#1e293b' }}>{req.name}</p>
                  <p style={{ margin:'2px 0', fontSize:12, color:'#64748b' }}>{req.email}</p>
                  <p style={{ margin:'4px 0 2px', fontSize:12, color:'#374151' }}>Requesting: <strong>{req.site}</strong></p>
                  {req.reason && <p style={{ margin:'2px 0', fontSize:12, color:'#64748b', fontStyle:'italic' }}>"{req.reason}"</p>}
                  <p style={{ margin:'4px 0 0', fontSize:11, color:'#94a3b8' }}>Requested: {fmtDate(req.requestedAt)}</p>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => approveRequest(req.id)}
                    style={{ background:'#2d6a27', color:'white', border:'none', padding:'6px 14px', borderRadius:'4px', fontSize:'12px', fontWeight:600, cursor:'pointer' }}>
                    ✓ Approve
                  </button>
                  <button onClick={() => rejectRequest(req.id)}
                    style={{ background:'white', color:'#dc2626', border:'1px solid #dc2626', padding:'6px 14px', borderRadius:'4px', fontSize:'12px', fontWeight:600, cursor:'pointer' }}>
                    ✗ Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Registered Users */}
      <div className="card" style={{ padding:20, marginBottom:20 }}>
        <h3 style={{ fontSize:15, fontWeight:600, color:'#1f4e1a', margin:'0 0 14px', display:'flex', alignItems:'center', gap:8 }}>
          <span>👥</span> Registered Users
          <span style={{ fontSize:11, color:'#64748b', fontWeight:400, marginLeft:4 }}>({allRegisteredUsers.length} total)</span>
        </h3>
        {allRegisteredUsers.map(u => (
          <div key={u.email} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px solid #f1f5f9' }}>
            <div style={{ width:36, height:36, borderRadius:'50%', background: u.role === 'ADMIN' ? '#b91c1c' : u.role === 'WORKER' ? '#1d4ed8' : '#2d6a27', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:13, fontWeight:700, flexShrink:0 }}>
              {u.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2)}
            </div>
            <div style={{ flex:1 }}>
              <p style={{ margin:0, fontSize:13, fontWeight:600, color:'#1e293b' }}>{u.name}</p>
              <p style={{ margin:0, fontSize:11, color:'#94a3b8' }}>{u.email} · {u.site}</p>
              {u.role === 'WORKER' && u.approvedAt && (
                <p style={{ margin:'2px 0 0', fontSize:10, color:'#16a34a' }}>✓ Approved · {fmtDate(u.approvedAt)}</p>
              )}
            </div>
            <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:4, background: u.role === 'ADMIN' ? '#fee2e2' : u.role === 'WORKER' ? '#dbeafe' : '#dcfce7', color: u.role === 'ADMIN' ? '#b91c1c' : u.role === 'WORKER' ? '#1d4ed8' : '#15803d' }}>
              {u.role}
            </span>
            {/* Remove button — only for admin, not for admin@gppms.com itself */}
            {isAdmin && u.email !== session.email && u.email !== 'admin@gppms.com' && (
              <button onClick={() => removeUser(u.email)}
                style={{ background:'white', color:'#dc2626', border:'1px solid #dc2626', padding:'4px 10px', borderRadius:'4px', fontSize:'11px', cursor:'pointer', marginLeft:'8px' }}>
                Remove
              </button>
            )}
          </div>
        ))}
      </div>

      {/* GA Locations — ADMIN ONLY */}
      {isAdmin && (
        <div className="card" style={{ padding:20, marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <h3 style={{ fontSize:15, fontWeight:600, color:'#1f4e1a', margin:0, display:'flex', alignItems:'center', gap:8 }}>
              <span>📍</span> GA Locations & Sites
            </h3>
            <button onClick={() => setShowLocModal(true)}
              style={{ background:'#2d6a27', color:'#fff', border:'none', borderRadius:6, padding:'8px 16px', fontSize:12, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
              + Add New GA Location
            </button>
          </div>
          {sites.length === 0 ? (
            <div style={{ textAlign:'center', padding:'32px 0', color:'#94a3b8', fontSize:13 }}>
              No GA Locations added yet. Click "+ Add New GA Location" to get started.
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:12 }}>
              {sites.map(s => (
                <div key={s.id} style={{ border:'1px solid #e2e8f0', borderRadius:8, padding:'14px 16px', background:'#f8fafc', display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <p style={{ margin:0, fontSize:13, fontWeight:700, color:'#1f4e1a' }}>{s.name}</p>
                    <span style={{ fontSize:10, fontWeight:700, padding:'2px 6px', borderRadius:4, background: s.status === 'Active' ? '#dcfce7' : '#fee2e2', color: s.status === 'Active' ? '#15803d' : '#b91c1c', flexShrink:0 }}>
                      {s.status}
                    </span>
                  </div>
                  <p style={{ margin:0, fontSize:11, color:'#64748b' }}>{s.zone || s.district || ''}</p>
                  {/* Cities and Areas hierarchy */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4, marginBottom: 4 }}>
                    {(s.cities || []).length === 0 ? (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Areas (Flat List):</div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:5, minHeight: 22 }}>
                          {(s.areas || []).map(area => (
                            <span key={area} style={{ display:'inline-flex', alignItems:'center', gap:3, background:'#e8f5e9', color:'#1f4e1a', borderRadius:12, padding:'2px 8px 2px 9px', fontSize:11, fontWeight:500 }}>
                              {area}
                              <button
                                onClick={() => handleRemoveArea(s.id, area)}
                                title={`Remove area "${area}"`}
                                style={{ background:'none', border:'none', cursor:'pointer', color:'#b91c1c', fontSize:13, lineHeight:1, padding:'0 0 0 2px', display:'flex', alignItems:'center', fontWeight:700 }}
                              >×</button>
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      (s.cities || []).map(city => (
                        <div key={city.id} style={{ borderBottom: '1px dashed #e2e8f0', paddingBottom: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>
                            🌆 {city.label}
                          </span>
                          <div style={{ display:'flex', flexWrap:'wrap', gap:4, alignItems: 'center' }}>
                            {(city.areas || []).map(area => (
                              <span key={area} style={{ display:'inline-flex', alignItems:'center', gap:3, background:'#e8f5e9', color:'#1f4e1a', borderRadius:10, padding:'1px 6px 1px 7px', fontSize:10, fontWeight:500 }}>
                                {area}
                                <button
                                  onClick={() => {
                                    const updated = sites.map(site => {
                                      if (site.id === s.id) {
                                        const updatedCities = (site.cities || []).map(c => 
                                          c.id === city.id ? { ...c, areas: (c.areas || []).filter(a => a !== area) } : c
                                        );
                                        return {
                                          ...site,
                                          cities: updatedCities,
                                          areas: (site.areas || []).filter(a => a !== area)
                                        };
                                      }
                                      return site;
                                    });
                                    setSites(updated);
                                    localStorage.setItem('gppms_sites', JSON.stringify(updated));
                                    window.dispatchEvent(new Event('storage'));
                                    showToast(`Area "${area}" removed`);
                                  }}
                                  title={`Remove area "${area}"`}
                                  style={{ background:'none', border:'none', cursor:'pointer', color:'#b91c1c', fontSize:11, padding:'0 0 0 2px', fontWeight:700 }}
                                >×</button>
                              </span>
                            ))}
                            <button
                              onClick={() => {
                                const areaName = prompt(`Enter new area name for city "${city.label}":`);
                                if (!areaName || !areaName.trim()) return;
                                const updated = sites.map(site => {
                                  if (site.id === s.id) {
                                    const updatedCities = (site.cities || []).map(c => 
                                      c.id === city.id ? { ...c, areas: [...(c.areas || []), areaName.trim()] } : c
                                    );
                                    return {
                                      ...site,
                                      cities: updatedCities,
                                      areas: [...(site.areas || []), areaName.trim()]
                                    };
                                  }
                                  return site;
                                });
                                setSites(updated);
                                localStorage.setItem('gppms_sites', JSON.stringify(updated));
                                window.dispatchEvent(new Event('storage'));
                                showToast(`✓ Area "${areaName.trim()}" added to "${city.label}"`);
                              }}
                              style={{ background:'none', border: '1px dashed #2d6a27', borderRadius:10, padding:'1px 6px', fontSize:10, color:'#2d6a27', cursor:'pointer', fontWeight:600 }}
                            >
                              + Area
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div style={{ display:'flex', gap:6, marginTop:8 }}>
                    <button
                      onClick={() => handleAddCity(s.id)}
                      style={{ flex:1, height:28, background:'#2d6a27', color:'#fff', border:'none', borderRadius:4, fontSize:11, fontWeight:600, cursor:'pointer' }}
                    >
                      + Add City
                    </button>
                    <button
                      onClick={() => handleRemoveSite(s.id, s.name)}
                      style={{ height:28, padding:'0 10px', background:'#fee2e2', color:'#dc2626', border:'1px solid #fca5a5', borderRadius:4, fontSize:11, fontWeight:600, cursor:'pointer' }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Info bar */}
      <div style={{ background:'#dbeafe', border:'1px solid #bfdbfe', borderRadius:8, padding:'10px 16px', fontSize:12, color:'#1e40af', display:'flex', alignItems:'center', gap:8 }}>
        <span>ℹ️</span>
        Full RBAC will be enforced once backend is connected. Currently using local mode authentication.
      </div>

      {/* ── Request Access Modal — conditionally rendered, not just hidden ── */}
      {showModal && (
        <div style={{ position:'fixed',inset:0,zIndex:1100,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div style={{ background:'#fff',borderRadius:14,width:'100%',maxWidth:460,boxShadow:'0 20px 60px rgba(0,0,0,0.25)',overflow:'hidden' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ background:'#1f4e1a',padding:'16px 20px',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
              <span style={{ color:'#fff',fontSize:15,fontWeight:700 }}>Request Site Editing Access</span>
              <button onClick={() => setShowModal(false)} style={{ background:'none',border:'none',color:'rgba(255,255,255,0.8)',fontSize:20,cursor:'pointer' }}>✕</button>
            </div>
            <div style={{ padding:24 }}>
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div>
                  <label style={{ fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:4 }}>Your Name</label>
                  <input value={rName} onChange={e => setRName(e.target.value)}
                    style={{ width:'100%',height:34,border:'1px solid #d1d5db',borderRadius:5,padding:'0 10px',fontSize:13,boxSizing:'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:4 }}>Your Email</label>
                  <input value={rEmail} readOnly
                    style={{ width:'100%',height:34,border:'1px solid #d1d5db',borderRadius:5,padding:'0 10px',fontSize:13,boxSizing:'border-box',background:'#f8fafc',color:'#94a3b8' }} />
                </div>
                <div>
                  <label style={{ fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:4 }}>Select Site</label>
                  {allSiteNames.length > 0 ? (
                    <select value={rSite} onChange={e => setRSite(e.target.value)}
                      style={{ width:'100%',height:34,border:'1px solid #d1d5db',borderRadius:5,padding:'0 10px',fontSize:13,boxSizing:'border-box',background:'#fff' }}>
                      {allSiteNames.map(s => <option key={s}>{s}</option>)}
                    </select>
                  ) : (
                    <>
                      <input
                        value={rSite}
                        onChange={e => setRSite(e.target.value)}
                        placeholder="Type the site / location name"
                        style={{ width:'100%',height:34,border:'1px solid #d1d5db',borderRadius:5,padding:'0 10px',fontSize:13,boxSizing:'border-box' }}
                      />
                      <p style={{ margin:'4px 0 0', fontSize:11, color:'#94a3b8' }}>
                        No GA locations have been added yet. You can type the site name to request access.
                      </p>
                    </>
                  )}
                </div>
                <div>
                  <label style={{ fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:4 }}>Reason (optional)</label>
                  <textarea value={rReason} onChange={e => setRReason(e.target.value)}
                    placeholder="e.g. I am the supervisor for this site" rows={3}
                    style={{ width:'100%',border:'1px solid #d1d5db',borderRadius:5,padding:'8px 10px',fontSize:13,boxSizing:'border-box',resize:'vertical' }} />
                </div>
              </div>
              <div style={{ display:'flex',gap:10,marginTop:20 }}>
                <button onClick={() => setShowModal(false)}
                  style={{ flex:1,height:38,background:'#f1f5f9',border:'1px solid #d1d5db',borderRadius:7,fontSize:13,fontWeight:600,cursor:'pointer',color:'#374151' }}>
                  Cancel
                </button>
                <button onClick={handleSubmitRequest}
                  disabled={!rName.trim() || !rSite}
                  style={{ flex:1,height:38,background: (!rName.trim() || !rSite) ? '#94a3b8' : '#2d6a27',border:'none',borderRadius:7,fontSize:13,fontWeight:600,cursor:(!rName.trim() || !rSite)?'not-allowed':'pointer',color:'#fff' }}>
                  Submit Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add GA Location Modal ── */}
      {showLocModal && (
        <div style={{ position:'fixed',inset:0,zIndex:1100,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',padding:16,overflowY:'auto' }}>
          <div style={{ background:'#fff',borderRadius:14,width:'100%',maxWidth:520,boxShadow:'0 20px 60px rgba(0,0,0,0.25)',overflow:'hidden',margin:'auto' }}>
            <div style={{ background:'#1f4e1a',padding:'16px 20px',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
              <span style={{ color:'#fff',fontSize:15,fontWeight:700 }}>Add New GA Location</span>
              <button onClick={() => setShowLocModal(false)} style={{ background:'none',border:'none',color:'rgba(255,255,255,0.8)',fontSize:20,cursor:'pointer' }}>✕</button>
            </div>
            <div style={{ padding:24, display:'flex', flexDirection:'column', gap:14, maxHeight:'75vh', overflowY:'auto' }}>
              {/* GA Location Name */}
              <div>
                <label style={{ fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:4 }}>GA Location Name *</label>
                <input value={locName} onChange={e => setLocName(e.target.value)}
                  placeholder="e.g. Sirsa"
                  style={{ width:'100%',height:34,border:'1px solid #d1d5db',borderRadius:5,padding:'0 10px',fontSize:13,boxSizing:'border-box' }} />
              </div>
              {/* Status */}
              <div>
                <label style={{ fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:4 }}>Status</label>
                <select value={locStatus} onChange={e => setLocStatus(e.target.value)}
                  style={{ width:140,height:34,border:'1px solid #d1d5db',borderRadius:5,padding:'0 10px',fontSize:13,background:'#fff' }}>
                  <option>Active</option><option>Inactive</option>
                </select>
              </div>
              {/* Cities section */}
              <div>
                <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8 }}>
                  <label style={{ fontSize:12,fontWeight:700,color:'#1f4e1a',textTransform:'uppercase',letterSpacing:0.5 }}>Cities under this GA Location</label>
                  <button type="button" onClick={addCityRow}
                    style={{ fontSize:12,fontWeight:600,color:'#2d6a27',background:'#f0f7ee',border:'1px dashed #2d6a27',borderRadius:4,padding:'4px 10px',cursor:'pointer' }}>
                    + Add Another City
                  </button>
                </div>
                <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
                  {locCities.map((city, idx) => (
                    <div key={idx} style={{ border:'1px solid #e2e8f0',borderRadius:8,padding:'12px 14px',background:'#f8fafc',position:'relative' }}>
                      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8 }}>
                        <span style={{ fontSize:12,fontWeight:600,color:'#374151' }}>City {idx + 1}</span>
                        {locCities.length > 1 && (
                          <button type="button" onClick={() => removeCityRow(idx)}
                            style={{ background:'#fee2e2',color:'#dc2626',border:'none',borderRadius:4,width:24,height:24,cursor:'pointer',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center' }}>×</button>
                        )}
                      </div>
                      <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                        <div>
                          <label style={{ fontSize:11,fontWeight:600,color:'#64748b',display:'block',marginBottom:3 }}>City Name *</label>
                          <input value={city.cityName} onChange={e => updateCityRow(idx, 'cityName', e.target.value)}
                            placeholder="e.g. Dabwali"
                            style={{ width:'100%',height:32,border:'1px solid #d1d5db',borderRadius:4,padding:'0 8px',fontSize:12,boxSizing:'border-box' }} />
                        </div>
                        <div>
                          <label style={{ fontSize:11,fontWeight:600,color:'#64748b',display:'block',marginBottom:3 }}>Areas (comma-separated)</label>
                          <input value={city.areasText} onChange={e => updateCityRow(idx, 'areasText', e.target.value)}
                            placeholder="e.g. Ward 1, Ward 2, Main Market"
                            style={{ width:'100%',height:32,border:'1px solid #d1d5db',borderRadius:4,padding:'0 8px',fontSize:12,boxSizing:'border-box' }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display:'flex',gap:10 }}>
                <button onClick={() => setShowLocModal(false)}
                  style={{ flex:1,height:38,background:'#f1f5f9',border:'1px solid #d1d5db',borderRadius:7,fontSize:13,fontWeight:600,cursor:'pointer',color:'#374151' }}>
                  Cancel
                </button>
                <button onClick={handleAddLocation}
                  style={{ flex:1,height:38,background:'#2d6a27',border:'none',borderRadius:7,fontSize:13,fontWeight:600,cursor:'pointer',color:'#fff' }}>
                  Add Location
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
