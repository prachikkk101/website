// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { SiteProvider } from './context/SiteContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Inventory from './pages/Inventory';
import PELaying from './pages/PELaying';
import Reports from './pages/Reports';
import Access from './pages/Access';

// Scroll to top on every route change
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <SiteProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />

            {/* Protected */}
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/"          element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/pe-laying" element={<PELaying />} />
                <Route path="/reports"   element={<Reports />} />
                <Route path="/access"    element={<Access />} />
                {/* Legacy redirects */}
                <Route path="/masters"   element={<Navigate to="/access" replace />} />
                <Route path="/ic-work"   element={<Navigate to="/dashboard" replace />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </SiteProvider>
    </AuthProvider>
  );
}
