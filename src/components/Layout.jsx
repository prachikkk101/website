// src/components/Layout.jsx
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useSite } from '../context/SiteContext';
import { useAuth } from '../context/AuthContext';
import ToastContainer from './Toast';

const navItems = [
  { label: 'GA Dashboard',     to: '/dashboard' },
  {
    label: 'Customer On-Board',
    to: '/customers',
    dropdown: true,
    submenu: [
      { label: 'House Connections', to: '/customers' },
      { label: 'I&C Work',         to: '/ic-work' },
    ]
  },
  { label: 'Inventory',        to: '/inventory' },
  { label: 'PE Laying',        to: '/pe-laying' },
  { label: 'Reports',          to: '/reports' },
  { label: 'Masters',          to: '/masters' },
];

const breadcrumbs = {
  '/dashboard': 'GA Dashboard — All Sites Overview',
  '/customers': 'Customer On-Board — House Connections',
  '/inventory': 'Inventory — Stock Management',
  '/pe-laying': 'PE Laying — Pipeline Progress',
  '/ic-work':   'I&C Work — Installation & Commissioning',
  '/reports':   'Reports — Analytics & Export',
  '/masters':   'Masters — Configuration',
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

const ROLE_BADGE_COLORS = {
  ADMIN:      { bg: '#fee2e2', color: '#b91c1c' },
  SUPERVISOR: { bg: '#dbeafe', color: '#1d4ed8' },
  WORKER:     { bg: '#dcfce7', color: '#15803d' },
  VIEWER:     { bg: '#f1f5f9', color: '#64748b' },
};

export default function Layout() {
  const location = useLocation();
  const { selectedSite, setSelectedSite, siteOptions } = useSite();
  const { user, logout } = useAuth();

  const breadcrumb = breadcrumbs[location.pathname] || 'GP-PMS';

  // Get user initials
  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '??';

  const roleBadge = ROLE_BADGE_COLORS[user?.role] || ROLE_BADGE_COLORS.VIEWER;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f0f4f0' }}>
      <ToastContainer />
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
                >
                  {item.label}
                  {item.dropdown && <ChevronDown />}
                </NavLink>
              );
            })}
          </nav>

          {/* Right side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', flexShrink: 0 }}>
            {/* Site selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              <select
                value={selectedSite}
                onChange={e => setSelectedSite(e.target.value)}
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  border: 'none',
                  color: '#fff',
                  fontSize: 12,
                  fontFamily: 'Inter,sans-serif',
                  fontWeight: 500,
                  cursor: 'pointer',
                  outline: 'none',
                  padding: '2px 4px',
                  borderRadius: 4,
                }}
              >
                {siteOptions.map(s => <option key={s.value} value={s.value} style={{ background: '#1f4e1a' }}>{s.label}</option>)}
              </select>
            </div>

            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 16 }}>|</span>

            {/* User info + role badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
            </div>

            {/* Logout button */}
            <button
              onClick={logout}
              title="Logout"
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none', borderRadius: 4,
                padding: '5px 8px', cursor: 'pointer',
                display: 'flex', alignItems: 'center',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(192,68,10,0.6)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
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
    </div>
  );
}
