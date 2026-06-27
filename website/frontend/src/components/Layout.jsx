// src/components/Layout.jsx
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useState, useContext } from 'react';
import { useSite, SITE_OPTIONS } from '../context/SiteContext';
import { AuthContext } from '../context/AuthContext';
import api from '../utils/api';

const navItems = [
  { label: 'GA Dashboard',     to: '/dashboard' },
  { label: 'Customer On-Board',to: '/customers', dropdown: true },
  { label: 'Inventory',        to: '/inventory', dropdown: true },
  { label: 'PE Laying',        to: '/pe-laying' },
  { label: 'I&C Work',         to: '/ic-work' },
  { label: 'Reports',          to: '/reports' },
  { label: 'Masters',          to: '/masters' },
  { label: 'Access Requests',  to: '/admin/requests', adminOnly: true },
];

const breadcrumbs = {
  '/dashboard': 'GA Dashboard — All Sites Overview',
  '/customers': 'Customer On-Board — House Connections',
  '/inventory': 'Inventory — Stock Management',
  '/pe-laying': 'PE Laying — Pipeline Progress',
  '/ic-work':   'I&C Work — Installation & Commissioning',
  '/reports':   'Reports — Analytics & Export',
  '/masters':   'Masters — Configuration',
  '/admin/requests': 'Admin — Site Access Requests',
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

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { selectedSite, setSelectedSite } = useSite();
  const { user, logout } = useContext(AuthContext);

  const breadcrumb = breadcrumbs[location.pathname] || 'GP-PMS';

  // Derive display name & initials from logged-in user
  const displayName = user?.name || user?.email?.split('@')[0] || 'User';
  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleRequestAccess = async () => {
    // Basic mapping for mocked sites to a dummy UUID or fetching real ones would go here
    // We send a request for the currently selected site from the context
    // This assumes the backend can handle the site request by name or we have real IDs.
    // For this demonstration, we'll alert the user to use proper IDs in a fully connected app.
    if (selectedSite === 'all') {
      alert('Please select a specific site first.');
      return;
    }
    
    try {
      // Find the site UUID from the backend if possible, or we just pass the mock name.
      // In a real integration, the SiteContext would hold actual site objects with IDs.
      const res = await api.post('/sites/request-access', { siteId: selectedSite });
      if (res.data.success) {
        alert('Access request submitted successfully!');
      }
    } catch (err) {
      // If it fails because selectedSite is not a UUID (due to mocked frontend), we show a friendly message.
      if (err.response?.status === 404 || err.response?.status === 400) {
        alert(err.response?.data?.error || 'Failed to submit access request.');
      } else {
        alert('Site request feature requires actual Site IDs from the database.');
      }
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f0f4f0' }}>
      {/* ── Top Navbar ── */}
      <header style={{ background: '#1f4e1a', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 1px 6px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', height: 48 }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.1)' }}>
            <FlameIcon />
            <span style={{ color: '#fff', fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>GP-PMS</span>
          </div>

          {/* Nav tabs */}
          <nav style={{ display: 'flex', alignItems: 'stretch', height: '100%', gap: 0, flex: 1, overflow: 'hidden' }}>
            {navItems.filter(item => !item.adminOnly || user?.role === 'ADMIN').map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-tab${isActive ? ' active' : ''}`}
              >
                {item.label}
                {item.dropdown && <ChevronDown />}
              </NavLink>
            ))}
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
                {SITE_OPTIONS.map(s => <option key={s.value} value={s.value} style={{ background: '#1f4e1a' }}>{s.label}</option>)}
              </select>
            </div>

            {user?.role !== 'ADMIN' && (
              <button
                onClick={handleRequestAccess}
                style={{
                  background: '#c0440a',
                  border: 'none',
                  borderRadius: 4,
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '4px 8px',
                  cursor: 'pointer',
                  marginLeft: 4,
                }}
              >
                Request Access
              </button>
            )}

            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 16 }}>|</span>

            {/* User + Logout */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: '#4a7c2f', border: '1.5px solid rgba(126,197,111,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0,
              }}>{initials}</div>
              <span style={{ color: '#fff', fontSize: 13, fontWeight: 500 }}>
                {displayName}
              </span>
              <button
                onClick={handleLogout}
                title="Sign out"
                style={{
                  marginLeft: 4,
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 6,
                  color: 'rgba(255,255,255,0.75)',
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '3px 9px',
                  cursor: 'pointer',
                  letterSpacing: '0.2px',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(220,53,69,0.25)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
              >
                Logout
              </button>
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
    </div>
  );
}
