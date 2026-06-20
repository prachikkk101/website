// src/components/Layout.jsx
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useState } from 'react';

const navItems = [
  { label: 'GA Dashboard', to: '/' },
  { label: 'Customer On-Board', to: '/customers', hasDropdown: true },
  { label: 'Inventory', to: '/inventory', hasDropdown: true },
  { label: 'PE Laying', to: '/pe-laying' },
  { label: 'I&C Work', to: '/ic-work' },
  { label: 'Reports', to: '/reports' },
  { label: 'Masters', to: '/masters' },
];

function FlameIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C12 2 7 8 7 13C7 15.76 9.24 18 12 18C14.76 18 17 15.76 17 13C17 8 12 2 12 2Z" fill="#7ec56f"/>
      <path d="M12 10C12 10 10 13 10 14.5C10 15.33 10.67 16 11.5 16C12.33 16 13 15.33 13 14.5C13 13 12 10 12 10Z" fill="#c0440a"/>
    </svg>
  );
}

function getBreadcrumb(pathname) {
  const map = {
    '/': 'GA Dashboard — All Sites Overview',
    '/customers': 'Customer On-Board — House Connections',
    '/inventory': 'Inventory — Stock Management',
    '/pe-laying': 'PE Laying — Pipeline Progress',
    '/ic-work': 'I&C Work — Installation & Commissioning',
    '/reports': 'Reports — Analytics & Export',
    '/masters': 'Masters — Configuration',
  };
  return map[pathname] || 'GP-PMS';
}

export default function Layout() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f3f6f0' }}>
      {/* Top Navbar */}
      <header style={{ background: '#1f4e1a' }} className="sticky top-0 z-50 shadow-lg">
        <div className="flex items-center h-14 px-4 gap-6">
          {/* Logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <FlameIcon />
            <span className="text-white font-bold text-xl tracking-tight">GP-PMS</span>
          </div>

          {/* Nav items */}
          <nav className="hidden md:flex items-stretch h-full gap-0 flex-1">
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center px-4 h-full text-sm font-medium transition-all border-b-2 whitespace-nowrap gap-1
                  ${isActive
                    ? 'bg-[#2d6a27] text-white border-[#7ec56f]'
                    : 'text-green-200 border-transparent hover:bg-[#2d6a27]/60 hover:text-white'
                  }`
                }
              >
                {item.label}
                {item.hasDropdown && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                  </svg>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Right side — site + user */}
          <div className="ml-auto flex items-center gap-4 flex-shrink-0">
            <div className="hidden sm:flex items-center gap-1 text-green-200 text-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              <span>Khanna</span>
              <span className="text-green-400">|</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#2d6a27] border-2 border-[#7ec56f] flex items-center justify-center text-white text-xs font-bold">
                AK
              </div>
              <span className="text-white text-sm font-semibold hidden sm:block">ATUL KU</span>
            </div>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-white p-1"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div style={{ background: '#1a3e16' }} className="md:hidden pb-2">
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `block px-4 py-2.5 text-sm font-medium border-l-4 transition-all
                  ${isActive
                    ? 'bg-[#2d6a27] text-white border-[#7ec56f]'
                    : 'text-green-200 border-transparent hover:bg-[#2d6a27]/60'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        )}

        {/* Subbar breadcrumb */}
        <div style={{ background: '#2d6a27' }} className="px-4 py-1.5 flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7ec56f" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span className="text-green-100 text-xs font-medium">{getBreadcrumb(location.pathname)}</span>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 p-4 md:p-5">
        <Outlet />
      </main>

      {/* Footer */}
      <footer style={{ background: '#1f4e1a' }} className="py-2 px-4 text-center text-green-300 text-xs">
        GP-PMS © 2025 — Gas Pipeline Project Management System
      </footer>
    </div>
  );
}
