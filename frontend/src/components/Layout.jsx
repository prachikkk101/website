// src/components/Layout.jsx
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useState, useContext, useEffect } from 'react';
import { useSite, SITE_OPTIONS } from '../context/SiteContext';
import { AuthContext } from '../context/AuthContext';
import { ToastContainer } from './Toast';
import { checkBackend } from '../utils/healthCheck';

const breadcrumbs = {
  '/dashboard': 'GA Dashboard — All Sites Overview',
  '/customers': 'PNG Connections — House Connections',
  '/inventory': 'Inventory — Stock Management',
  '/pe-laying': 'PE Laying — Pipeline Progress',
  '/reports':   'Reports — Daily Progress',
  '/access':    'Access — User Management',
};

// TODO: Place the Oxygen Protech logo file at public/logo.png in the project root.
// The logo should be a PNG with transparent background, minimum 200x200px resolution.
// Current file: the blue triangular OP logo.

function getSession() {
  try { return JSON.parse(localStorage.getItem('gppms_session') || '{}'); } catch { return {}; }
}

function getPendingCount() {
  try {
    const reqs = JSON.parse(localStorage.getItem('gppms_access_requests') || '[]');
    return reqs.filter(r => r.status === 'pending').length;
  } catch { return 0; }
}

export default function Layout() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { selectedSite, setSelectedSite } = useSite();
  const { user, logout } = useContext(AuthContext);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [backendStatus,  setBackendStatus]  = useState('checking'); // 'checking'|'connected'|'offline'
  const [pendingCount,   setPendingCount]   = useState(0);

  // Close mobile menu on route change
  useEffect(() => { setMobileMenuOpen(false); }, [location.pathname]);

  // Re-read pending count whenever location changes (Access page approvals update it)
  useEffect(() => { setPendingCount(getPendingCount()); }, [location.pathname]);

  // Backend health check on mount
  useEffect(() => {
    checkBackend().then(result => {
      setBackendStatus(result.status === 'connected' ? 'connected' : 'offline');
      if (result.status === 'connected') {
        const session = getSession();
        if (session.isLocalMode) {
          localStorage.setItem('gppms_session', JSON.stringify({ ...session, isLocalMode: false }));
          window.location.reload();
        }
      }
    });
  }, []);

  const session       = getSession();
  const breadcrumb    = breadcrumbs[location.pathname] || 'GP-PMS';
  const displayName   = session.name || user?.name || user?.email?.split('@')[0] || 'User';
  const initials      = displayName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const picture       = session.picture || null;
  const isLocalMode   = session.isLocalMode === true;
  const roleBadge     = user?.role === 'ADMIN'
    ? { bg: '#fee2e2', color: '#b91c1c' }
    : { bg: '#dbeafe', color: '#1d4ed8' };

  // Admin check — role OR email fallback
  const isAdmin = (
    user?.role === 'ADMIN' ||
    user?.role === 'admin' ||
    ['oxygenhisar@gmail.com', 'oxygenprotech@gmail.com', 'admin@gppms.com']
      .includes((session.email || '').toLowerCase())
  );
  // Supervisor with no site assigned => view-only
  const isSupervisor  = user?.role === 'SUPERVISOR';
  const siteAccess    = session.siteAccess;
  const showViewOnlyBanner = !isAdmin && (!siteAccess || siteAccess === 'none' || siteAccess === null);

  const handleLogout = () => { logout(); navigate('/login'); };

  // Nav items — include site selector visually right after PNG Connections
  const navItems = [
    { label: 'GA Dashboard',    to: '/dashboard' },
    { label: 'PNG Connections', to: '/customers' },
    { label: 'Inventory',       to: '/inventory' },
    { label: 'PE Laying',       to: '/pe-laying' },
    { label: 'Reports',         to: '/reports'   },
    { label: 'Access',          to: '/access',   badge: pendingCount > 0 ? pendingCount : null },
  ];

  // Hide site selector for supervisors who have a site assigned
  const showSiteSelector = !(isSupervisor && siteAccess && siteAccess !== 'none');

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f0f4f0' }}>
      <ToastContainer />

      {/* ── Top Navbar ── */}
      <header style={{ background: '#1f4e1a', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 1px 6px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', height: 48 }}>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.1)' }}>
            <img
              src="/logo.png"
              alt="Oxygen Protech"
              style={{ height: 32, width: 'auto', objectFit: 'contain', borderRadius: 4 }}
              onError={e => { e.currentTarget.style.display = 'none'; }}
            />
            <span style={{ color: '#fff', fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>Oxygen Protech Gas</span>
          </div>

          {/* Desktop nav — hidden on mobile */}
          <nav className="desktop-nav" style={{ display: 'flex', alignItems: 'stretch', height: '100%', flex: 1, overflowX: 'auto', scrollbarWidth: 'none' }}>
            <style>{`nav.desktop-nav::-webkit-scrollbar { display: none; } @media(max-width:767px){nav.desktop-nav{display:none!important}}`}</style>

            {/* GA Dashboard tab */}
            <NavLink to="/dashboard" className={({ isActive }) => `nav-tab${isActive ? ' active' : ''}`} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
              GA Dashboard
            </NavLink>

            {/* PNG Connections tab + inline site selector */}
            <NavLink to="/customers" className={({ isActive }) => `nav-tab${isActive ? ' active' : ''}`} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
              PNG Connections
            </NavLink>

            {/* Site selector — inline right after PNG Connections */}
            {showSiteSelector && (
              <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" style={{ marginRight: 4, flexShrink: 0 }}>
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                <select
                  value={selectedSite}
                  onChange={e => setSelectedSite(e.target.value)}
                  style={{
                    width: 160, height: 32,
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.18)',
                    color: '#fff', fontSize: 11.5,
                    fontFamily: 'Inter,sans-serif', fontWeight: 500,
                    cursor: 'pointer', outline: 'none',
                    padding: '0 6px', borderRadius: 5,
                  }}
                >
                  {SITE_OPTIONS.map(s => <option key={s.value} value={s.value} style={{ background: '#1f4e1a' }}>{s.label}</option>)}
                </select>
              </div>
            )}

            {/* Remaining nav tabs */}
            {[
              { label: 'Inventory', to: '/inventory' },
              { label: 'PE Laying', to: '/pe-laying' },
              { label: 'Reports',   to: '/reports'   },
              { label: 'Access',    to: '/access',   badge: pendingCount > 0 ? pendingCount : null },
            ].map(item => (
              <NavLink key={item.to} to={item.to}
                className={({ isActive }) => `nav-tab${isActive ? ' active' : ''}`}
                style={{ whiteSpace: 'nowrap', flexShrink: 0, position: 'relative' }}
              >
                {item.label}
                {item.badge && (
                  <span style={{
                    background: '#c0440a', color: 'white',
                    borderRadius: '50%', width: 16, height: 16,
                    fontSize: 10, display: 'inline-flex',
                    alignItems: 'center', justifyContent: 'center',
                    marginLeft: 4,
                  }}>{item.badge}</span>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Right side — desktop */}
          <div className="desktop-right" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', flexShrink: 0, marginLeft: 'auto' }}>
            <style>{`@media(max-width:767px){.desktop-right{display:none!important}}`}</style>

            {/* Backend / local mode badge */}
            {isLocalMode && backendStatus !== 'connected' && (
              <span
                title="Running on local data. Backend not connected."
                style={{ fontSize: 10, background: '#fef3c7', color: '#92400e', borderRadius: 10, padding: '2px 7px', fontWeight: 600, cursor: 'help' }}
              >
                ● Local Mode
              </span>
            )}

            <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 16 }}>|</span>

            {/* Avatar + name + logout */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', overflow: 'hidden', background: '#4a7c2f', border: '1.5px solid rgba(126,197,111,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                {picture ? <img src={picture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ color: '#fff', fontSize: 11, fontWeight: 600, lineHeight: 1.2 }}>{displayName}</span>
                {isAdmin ? (
                  <span style={{ fontSize: '10px', background: '#d1fae5', color: '#166534', borderRadius: '4px', padding: '1px 6px', fontWeight: 600 }}>
                    All Sites
                  </span>
                ) : (siteAccess && siteAccess !== 'none') ? (
                  <span style={{ fontSize: '10px', background: '#dbeafe', color: '#1e40af', borderRadius: '4px', padding: '1px 6px', fontWeight: 600, whiteSpace: 'nowrap', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block' }}>
                    {siteAccess}
                  </span>
                ) : (
                  <span style={{ fontSize: '10px', background: '#fef3c7', color: '#92400e', borderRadius: '4px', padding: '1px 6px', fontWeight: 600 }}>
                    No Site Assigned
                  </span>
                )}
              </div>
              <button onClick={handleLogout} title="Sign out"
                style={{ marginLeft: 2, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 5, color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: 600, padding: '3px 8px', cursor: 'pointer', letterSpacing: '0.2px', transition: 'background 0.15s', whiteSpace: 'nowrap' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(220,53,69,0.25)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
              >Logout</button>
            </div>
          </div>

          {/* Hamburger — mobile only */}
          <button
            className="mobile-hamburger"
            onClick={() => setMobileMenuOpen(v => !v)}
            style={{ display: 'none', marginLeft: 'auto', marginRight: 10, background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', padding: '4px 8px' }}
          >
            <style>{`@media(max-width:767px){.mobile-hamburger{display:block!important}}`}</style>
            ☰
          </button>
        </div>

        {/* Breadcrumb */}
        <div style={{ background: '#2d6a27', padding: '5px 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7ec56f" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span style={{ color: '#d4edcf', fontSize: 12, fontWeight: 500 }}>{breadcrumb}</span>
        </div>
      </header>

      {/* ── Mobile Menu Overlay ── */}
      {mobileMenuOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)' }} onClick={() => setMobileMenuOpen(false)} />
      )}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 201,
        background: '#1f4e1a', transform: mobileMenuOpen ? 'translateY(0)' : 'translateY(-100%)',
        transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        paddingBottom: 16,
      }}>
        {/* Mobile header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', height: 56, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>🔥 GP-PMS Menu</span>
          <button onClick={() => setMobileMenuOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Site selector in menu */}
        {showSiteSelector && (
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 4 }}>Current Site</label>
            <select value={selectedSite} onChange={e => setSelectedSite(e.target.value)}
              style={{ width: '100%', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: 6, padding: '8px 10px', fontSize: 13 }}>
              {SITE_OPTIONS.map(s => <option key={s.value} value={s.value} style={{ background: '#1f4e1a' }}>{s.label}</option>)}
            </select>
          </div>
        )}

        {/* Nav items */}
        {navItems.map(item => (
          <NavLink key={item.to} to={item.to}
            className={({ isActive }) => `nav-tab${isActive ? ' active' : ''}`}
            style={{ display: 'flex', alignItems: 'center', height: 48, padding: '0 20px', fontSize: 14, borderBottom: '1px solid rgba(255,255,255,0.06)', borderRadius: 0 }}
          >
            {item.label}
            {item.badge && (
              <span style={{ background: '#c0440a', color: 'white', borderRadius: '50%', width: 16, height: 16, fontSize: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginLeft: 6 }}>{item.badge}</span>
            )}
          </NavLink>
        ))}

        {/* Logout at bottom */}
        <div style={{ padding: '12px 16px', marginTop: 4 }}>
          <button onClick={handleLogout}
            style={{ width: '100%', padding: '12px', background: 'rgba(220,53,69,0.2)', border: '1px solid rgba(220,53,69,0.3)', color: '#fca5a5', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Sign Out
          </button>
        </div>
      </div>

      {/* View-only banner — only for non-admin users with no site assigned */}
      {showViewOnlyBanner && (
        <div style={{
          background: '#fffbeb', borderBottom: '2px solid #f59e0b',
          padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 18 }}>⚠</span>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#92400e' }}>You have view-only access. </span>
            <span style={{ fontSize: 13, color: '#78350f' }}>Go to Access tab to request site editing permissions.</span>
          </div>
          <button onClick={() => navigate('/access')}
            style={{ background: '#2d6a27', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Request Access →
          </button>
        </div>
      )}

      {/* ── Page content ── */}
      <main style={{ flex: 1, padding: 16 }}>
        <Outlet />
      </main>

      {/* ── Footer ── */}
      <footer style={{ background: '#1f4e1a', padding: '8px 16px', textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>
        GP-PMS © 2026 — Gas Pipeline Project Management System
      </footer>
    </div>
  );
}
