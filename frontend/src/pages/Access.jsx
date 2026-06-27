// src/pages/Access.jsx
import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useToast } from '../components/Toast';

const ALL_SITES = ['Khanna \u2014 CA-09', 'UE-II \u2014 Hisar', 'PLA \u2014 Hisar', 'Kohara \u2014 CA-07'];

function getSession() {
  try { return JSON.parse(localStorage.getItem('gppms_session') || '{}'); } catch { return {}; }
}

function getRequests() {
  try { return JSON.parse(localStorage.getItem('gppms_access_requests') || '[]'); } catch { return []; }
}

function saveRequests(reqs) {
  localStorage.setItem('gppms_access_requests', JSON.stringify(reqs));
}

function fmtDate(iso) {
  try { return new Date(iso).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }); }
  catch { return iso; }
}

// Hardcoded registered users list (would come from backend in production)
const REGISTERED_USERS = [
  { name: 'Admin User',      email: 'admin@gppms.com',          role: 'ADMIN',      site: 'All Sites' },
  { name: 'Atul Kumar',      email: 'atul@oxygenprotech.com',    role: 'SUPERVISOR', site: 'Khanna CA-09' },
  { name: 'Ravi Sharma',     email: 'ravi@oxygenprotech.com',    role: 'SUPERVISOR', site: 'UE-II Hisar' },
  { name: 'Gurpreet Singh',  email: 'gurpreet@oxygenprotech.com',role: 'WORKER',     site: 'PLA Hisar' },
];

export default function Access() {
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [requests, setRequests]   = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const session = getSession();
  const isAdmin      = user?.role === 'ADMIN';
  const isSupervisor = user?.role === 'SUPERVISOR';
  const siteAccess   = session.siteAccess;
  const isViewOnly   = isSupervisor && (!siteAccess || siteAccess === 'none');

  useEffect(() => {
    document.title = 'GP-PMS \u2014 Access Management';
    setRequests(getRequests());
  }, []);

  const pendingRequests = requests.filter(r => r.status === 'pending');

  // Request modal form state
  const [rName,   setRName]   = useState(session.name   || '');
  const [rEmail,  setREmail]  = useState(session.email  || '');
  const [rSite,   setRSite]   = useState(ALL_SITES[0]);
  const [rReason, setRReason] = useState('');

  function handleSubmitRequest() {
    const newReq = {
      id: Date.now(),
      name: rName, email: rEmail,
      site: rSite, reason: rReason,
      status: 'pending',
      requestedAt: new Date().toISOString(),
    };
    const updated = [...requests, newReq];
    setRequests(updated);
    saveRequests(updated);
    setSubmitted(true);
  }

  function handleApprove(req) {
    const updated = requests.map(r =>
      r.id === req.id ? { ...r, status: 'approved' } : r
    );
    setRequests(updated);
    saveRequests(updated);
    // Update gppms_users if exists
    try {
      const users = JSON.parse(localStorage.getItem('gppms_users') || '[]');
      const updatedUsers = users.map(u =>
        u.email === req.email ? { ...u, siteAccess: req.site } : u
      );
      if (!updatedUsers.find(u => u.email === req.email)) {
        updatedUsers.push({ email: req.email, siteAccess: req.site });
      }
      localStorage.setItem('gppms_users', JSON.stringify(updatedUsers));
    } catch {}
    showToast(`\u2713 Access granted to ${req.name} for ${req.site}`);
  }

  function handleReject(req) {
    const updated = requests.map(r =>
      r.id === req.id ? { ...r, status: 'rejected' } : r
    );
    setRequests(updated);
    saveRequests(updated);
    showToast('Request rejected');
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1f4e1a', margin: 0 }}>Access Management</h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>Manage user roles, site access, and permissions</p>
        </div>
      </div>

      {/* Supervisor without access — Request panel */}
      {isViewOnly && (
        <div className="card" style={{ padding: 20, marginBottom: 20, border: '2px solid #fbbf24', background: '#fffbeb' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <span style={{ fontSize: 28 }}>🔐</span>
            <div style={{ flex: 1 }}>
              <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#92400e' }}>Request Site Access</p>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: '#78350f' }}>You currently have view-only access. Request access to edit a specific site.</p>
              <button onClick={() => { setSubmitted(false); setShowModal(true); }}
                style={{ background: '#2d6a27', color: '#fff', border: 'none', borderRadius: 7, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Request Access to a Site
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin — Pending Requests */}
      {isAdmin && (
        <div className="card section-block" style={{ padding: 20, marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#c0440a', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            📋 Pending Access Requests
            {pendingRequests.length > 0 && (
              <span style={{ background: '#c0440a', color: '#fff', borderRadius: '50%', width: 20, height: 20, fontSize: 11, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                {pendingRequests.length}
              </span>
            )}
          </h3>

          {pendingRequests.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: 13 }}>No pending requests.</p>
          ) : pendingRequests.map(req => (
            <div key={req.id} style={{ border: '1px solid #fde68a', borderRadius: 8, padding: '14px 16px', marginBottom: 10, background: '#fffbeb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{req.name}</p>
                  <p style={{ margin: '2px 0', fontSize: 12, color: '#64748b' }}>{req.email}</p>
                  <p style={{ margin: '4px 0 2px', fontSize: 12, color: '#374151' }}>Requesting: <strong>{req.site}</strong></p>
                  {req.reason && <p style={{ margin: '2px 0', fontSize: 12, color: '#64748b', fontStyle: 'italic' }}>"{req.reason}"</p>}
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: '#94a3b8' }}>Requested: {fmtDate(req.requestedAt)}</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => handleApprove(req)}
                    style={{ height: 32, background: '#2d6a27', color: '#fff', border: 'none', borderRadius: 5, padding: '0 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    \u2713 Approve
                  </button>
                  <button onClick={() => handleReject(req)}
                    style={{ height: 32, background: '#fff', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 5, padding: '0 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    \u2715 Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Registered Users */}
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1f4e1a', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>👥</span> Registered Users
        </h3>
        {REGISTERED_USERS.map(u => (
          <div key={u.email} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: u.role === 'ADMIN' ? '#b91c1c' : u.role === 'SUPERVISOR' ? '#1d4ed8' : '#2d6a27', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
              {u.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{u.name}</p>
              <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>{u.email} · {u.site}</p>
            </div>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
              background: u.role === 'ADMIN' ? '#fee2e2' : u.role === 'SUPERVISOR' ? '#dbeafe' : '#dcfce7',
              color: u.role === 'ADMIN' ? '#b91c1c' : u.role === 'SUPERVISOR' ? '#1d4ed8' : '#15803d',
            }}>{u.role}</span>
          </div>
        ))}
      </div>

      {/* Info bar */}
      <div style={{ marginTop: 16, background: '#dbeafe', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 16px', fontSize: 12, color: '#1e40af', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>ℹ️</span>
        Full RBAC will be enforced once backend is connected. Currently using local mode authentication.
      </div>

      {/* Request Access Modal */}
      {showModal && (
        <div style={{ position:'fixed',inset:0,zIndex:1100,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}>
          <div style={{ background:'#fff',borderRadius:14,width:'100%',maxWidth:460,boxShadow:'0 20px 60px rgba(0,0,0,0.25)',overflow:'hidden' }}>
            <div style={{ background:'#1f4e1a',padding:'16px 20px',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
              <span style={{ color:'#fff',fontSize:15,fontWeight:700 }}>Request Site Editing Access</span>
              <button onClick={() => setShowModal(false)} style={{ background:'none',border:'none',color:'rgba(255,255,255,0.8)',fontSize:20,cursor:'pointer' }}>✕</button>
            </div>
            <div style={{ padding:24 }}>
              {submitted ? (
                <div style={{ textAlign:'center',padding:'20px 0' }}>
                  <div style={{ fontSize:40,marginBottom:12 }}>✅</div>
                  <p style={{ fontSize:15,fontWeight:700,color:'#15803d',marginBottom:8 }}>Request submitted!</p>
                  <p style={{ fontSize:13,color:'#64748b' }}>Your admin will review and approve your access.</p>
                  <button onClick={() => setShowModal(false)}
                    style={{ marginTop:16,background:'#2d6a27',color:'#fff',border:'none',borderRadius:7,padding:'10px 24px',fontSize:13,fontWeight:600,cursor:'pointer' }}>
                    Close
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
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
                      <select value={rSite} onChange={e => setRSite(e.target.value)}
                        style={{ width:'100%',height:34,border:'1px solid #d1d5db',borderRadius:5,padding:'0 10px',fontSize:13,boxSizing:'border-box',background:'#fff' }}>
                        {ALL_SITES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:4 }}>Reason / Note (optional)</label>
                      <textarea value={rReason} onChange={e => setRReason(e.target.value)}
                        placeholder="e.g. I am the supervisor for this site"
                        rows={3}
                        style={{ width:'100%',border:'1px solid #d1d5db',borderRadius:5,padding:'8px 10px',fontSize:13,boxSizing:'border-box',resize:'vertical' }} />
                    </div>
                  </div>
                  <div style={{ display:'flex',gap:10,marginTop:20 }}>
                    <button onClick={() => setShowModal(false)}
                      style={{ flex:1,height:38,background:'#f1f5f9',border:'1px solid #d1d5db',borderRadius:7,fontSize:13,fontWeight:600,cursor:'pointer',color:'#374151' }}>
                      Cancel
                    </button>
                    <button onClick={handleSubmitRequest}
                      style={{ flex:1,height:38,background:'#2d6a27',border:'none',borderRadius:7,fontSize:13,fontWeight:600,cursor:'pointer',color:'#fff' }}>
                      Submit Request
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
