// src/components/Layout.jsx
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useSite } from '../context/SiteContext';
import { useAuth } from '../context/AuthContext';
import ToastContainer from './Toast';

/* ── Nav definitions ── */
const ADMIN_NAV = [
  { label: 'GA Dashboard',    to: '/dashboard' },
  {
    label: 'Customer On-Board',
    to: '/customers',
    dropdown: true,
    submenu: [
      { label: 'House Connections', to: '/customers' },
      { label: 'I&C Work',          to: '/ic-work' },
    ],
  },
  { label: 'Inventory',   to: '/inventory' },
  { label: 'PE Laying',   to: '/pe-laying' },
  { label: 'Reports',     to: '/reports' },
  { label: 'Masters',     to: '/masters', isMasters: true },
];

const WORKER_NAV = [
  { label: 'My Site',         to: '/my-site' },
  { label: 'PNG Connections', to: '/customers' },
  { label: 'Inventory',       to: '/inventory', readOnly: true },
  { label: 'PE Laying',       to: '/pe-laying' },
];

const breadcrumbs = {
  '/dashboard':              'GA Dashboard — All Sites Overview',
  '/customers':              'Customer On-Board — House Connections',
  '/inventory':              'Inventory — Stock Management',
  '/pe-laying':              'PE Laying — Pipeline Progress',
  '/ic-work':                'I&C Work — Installation & Commissioning',
  '/reports':                'Reports — Analytics & Export',
  '/masters':                'Masters — Configuration',
  '/masters/access-requests':'Masters — Access Requests',
  '/my-site':                'My Site — Work Overview',
};

const ROLE_BADGE_COLORS = {
  ADMIN:      { bg: '#fee2e2', color: '#b91c1c' },
  SUPERVISOR: { bg: '#dbeafe', color: '#1d4ed8' },
  WORKER:     { bg: '#dcfce7', color: '#15803d' },
  VIEWER:     { bg: '#f1f5f9', color: '#64748b' },
};

function FlameIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M12 2C12 2 7 8 7 13C7 15.76 9.24 18 12 18C14.76 18 17 15.76 17 13C17 8 12 2 12 2Z" fill="#7ec56f"/>
      <path d="M12 10C12 10 10 13 10 14.5C10 15.33 10.67 16 11.5 16C12.33 16 13 15.33 13 14.5C13 13 12 10 12 10Z" fill="#c0440a"/>
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M2 4l4 4 4-4"/>
    </svg>
  );
}

/* ── Access Request Popup (bottom-right) ── */
function AccessRequestPopup({ request, onDismiss, onReview }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Slide up
    const t1 = setTimeout(() => setVisible(true), 50);
    // Auto-dismiss after 15s
    const t2 = setTimeout(() => onDismiss(), 15_000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDismiss]);

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      width: 320,
      background: '#fff',
      borderRadius: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      padding: 16,
      zIndex: 3000,
      border: '1px solid #e2e8f0',
      transform: visible ? 'translateY(0)' : 'translateY(80px)',
      opacity: visible ? 1 : 0,
      transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.35s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 20 }}>🔔</span>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#1e293b' }}>New Access Request</p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
            <strong>{request.name}</strong> ({request.email}) is requesting{' '}
            <strong>{request.role}</strong> access to <strong>{request.site}</strong>
          </p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onReview}
          style={{
            flex: 1, height: 34, background: '#2d6a27', color: '#fff', border: 'none',
            borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}
        >
          Review Now
        </button>
        <button
          onClick={onDismiss}
          style={{
            flex: 1, height: 34, background: '#f8fafc', color: '#64748b',
            border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

/* ══════════ MAIN LAYOUT ══════════ */
export default function Layout() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { selectedSite, setSelectedSite, siteOptions } = useSite();
  const { user, logout, pendingRequestCount, newAccessRequest, clearNewRequest } = useAuth();

  const isAdmin      = user?.role === 'ADMIN';
  const navItems     = isAdmin ? ADMIN_NAV : WORKER_NAV;
  const breadcrumb   = breadcrumbs[location.pathname] || 'GP-PMS';

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '??';
  const roleBadge = ROLE_BADGE_COLORS[user?.role] || ROLE_BADGE_COLORS.VIEWER;

  // Read session for isLocalMode
  const isLocalMode = (() => {
    try {
      const s = JSON.parse(localStorage.getItem('gppms_session') || '{}');
      return s.isLocalMode === true;
    } catch { return false; }
  })();

  // User dropdown state
  const [showUserMenu, setShowUserMenu] = useState(false);

  function handleReviewNow() {
    clearNewRequest();
    navigate('/masters/access-requests');
  }

  function handleSignOut() {
    setShowUserMenu(false);
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f0f4f0' }}>
      <ToastContainer />

      {/* ── Access Request Popup ── */}
      {newAccessRequest && (
        <AccessRequestPopup
          request={newAccessRequest}
          onDismiss={clearNewRequest}
          onReview={handleReviewNow}
        />
      )}

      {/* ── Top Navbar ── */}
      <header style={{ background: '#1f4e1a', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 1px 6px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', height: 48 }}>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.1)' }}>
            <FlameIcon />
            <span style={{ color: '#fff', fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>GP-PMS</span>
          </div>

          {/* Nav tabs */}
          <nav style={{ display: 'flex', alignItems: 'stretch', height: '100%', gap: 0, flex: 1, overflow: 'visible' }}>
            {navItems.map(item => {
              if (item.submenu) {
                const isSubActive = item.submenu.some(sub => location.pathname === sub.to);
                return (
                  <div
                    key={item.label}
                    className="nav-tab-container"
                    style={{ position: 'relative', display: 'flex', alignItems: 'stretch' }}
                  >
                    <NavLink
                      to={item.to}
                      className={() => `nav-tab${isSubActive ? ' active' : ''}`}
                    >
                      {item.label}
                      <ChevronDown />
                    </NavLink>
                    <div className="nav-dropdown-menu">
                      {item.submenu.map(sub => (
                        <NavLink
                          key={sub.to}
                          to={sub.to}
                          className={({ isActive }) => `nav-dropdown-item${isActive ? ' active' : ''}`}
                        >
                          {sub.label}
                        </NavLink>
                      ))}
                    </div>
                  </div>
                );
              }

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `nav-tab${isActive ? ' active' : ''}`}
                  style={{ position: 'relative' }}
                >
                  {item.label}
                  {item.readOnly && (
                    <span style={{ fontSize: 8, background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', borderRadius: 3, padding: '1px 4px', marginLeft: 4, verticalAlign: 'middle' }}>
                      READ
                    </span>
                  )}
                  {/* Masters badge */}
                  {item.isMasters && isAdmin && pendingRequestCount > 0 && (
                    <span style={{
                      position: 'absolute',
                      top: 6,
                      right: 4,
                      minWidth: 16,
                      height: 16,
                      background: '#f97316',
                      color: '#fff',
                      borderRadius: '50%',
                      fontSize: 9,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 3px',
                      boxShadow: '0 0 0 2px #1f4e1a',
                    }}>
                      {pendingRequestCount > 9 ? '9+' : pendingRequestCount}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* Right side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', flexShrink: 0 }}>
            {/* Site selector — only for admin */}
            {isAdmin && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                <select
                  value={selectedSite}
                  onChange={e => setSelectedSite(e.target.value)}
                  style={{
                    background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff',
                    fontSize: 12, fontFamily: 'Inter,sans-serif', fontWeight: 500,
                    cursor: 'pointer', outline: 'none', padding: '2px 4px', borderRadius: 4,
                  }}
                >
                  {siteOptions.map(s => <option key={s.value} value={s.value} style={{ background: '#1f4e1a' }}>{s.label}</option>)}
                </select>
              </div>
            )}

            {/* LOCAL MODE indicator */}
            {isLocalMode && (
              <span style={{
                fontSize: 10,
                background: '#fef3c7',
                color: '#92400e',
                borderRadius: 10,
                padding: '2px 8px',
                marginLeft: 6,
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}>● Local Mode</span>
            )}

            {isAdmin && <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 16 }}>|</span>}

            {/* User info + role badge + dropdown */}
            <div style={{ position: 'relative' }}>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                onClick={() => setShowUserMenu(prev => !prev)}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: '#4a7c2f', border: '1.5px solid rgba(126,197,111,0.5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0,
                }}>{initials}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ color: '#fff', fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}>
                    {user?.name || 'User'}
                  </span>
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                    background: roleBadge.bg, color: roleBadge.color, lineHeight: 1.3,
                    display: 'inline-block', width: 'fit-content',
                  }}>
                    {user?.role || 'WORKER'}
                  </span>
                </div>
                <ChevronDown />
              </div>

              {/* Dropdown menu */}
              {showUserMenu && (
                <>
                  {/* Invisible overlay to close dropdown when clicking outside */}
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 199 }}
                    onClick={() => setShowUserMenu(false)}
                  />
                  <div style={{
                    position: 'absolute',
                    top: '110%',
                    right: 0,
                    background: '#fff',
                    borderRadius: 8,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                    border: '1px solid #e2e8f0',
                    minWidth: 160,
                    zIndex: 200,
                    overflow: 'hidden',
                    animation: 'slideUp 0.15s ease',
                  }}>
                    <button
                      onClick={() => { setShowUserMenu(false); }}
                      style={{
                        width: '100%', padding: '10px 14px', background: 'none', border: 'none',
                        textAlign: 'left', fontSize: 13, color: '#374151', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f0f4f0'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                      </svg>
                      My Profile
                    </button>
                    <div style={{ height: 1, background: '#e2e8f0' }} />
                    <button
                      onClick={handleSignOut}
                      style={{
                        width: '100%', padding: '10px 14px', background: 'none', border: 'none',
                        textAlign: 'left', fontSize: 13, color: '#b91c1c', cursor: 'pointer',
                        fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#fee2e2'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                        <polyline points="16 17 21 12 16 7"/>
                        <line x1="21" y1="12" x2="9" y2="12"/>
                      </svg>
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Breadcrumb subbar */}
        <div style={{ background: '#2d6a27', padding: '5px 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7ec56f" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span style={{ color: '#d4edcf', fontSize: 12, fontWeight: 500 }}>{breadcrumb}</span>
        </div>
      </header>

      {/* ── Page content ── */}
      <main style={{ flex: 1, padding: 16 }}>
        <Outlet />
      </main>

      {/* ── Footer ── */}
      <footer style={{ background: '#1f4e1a', padding: '8px 16px', textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>
        GP-PMS © 2025 — Gas Pipeline Project Management System
      </footer>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
