// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { SiteProvider } from './context/SiteContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
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

// Wraps a page with its own error boundary so one page crash doesn't kill all others
function SafePage({ children }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <SiteProvider>
          <BrowserRouter>
            <ScrollToTop />
            <Routes>
              {/* Public */}
              <Route path="/login" element={<SafePage><Login /></SafePage>} />

              {/* Protected */}
              <Route element={<ProtectedRoute />}>
                <Route element={<ErrorBoundary><Layout /></ErrorBoundary>}>
                  <Route path="/"          element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<SafePage><Dashboard /></SafePage>} />
                  <Route path="/customers" element={<SafePage><Customers /></SafePage>} />
                  <Route path="/inventory" element={<SafePage><Inventory /></SafePage>} />
                  <Route path="/pe-laying" element={<SafePage><PELaying /></SafePage>} />
                  <Route path="/reports"   element={<SafePage><Reports /></SafePage>} />
                  <Route path="/access"    element={<SafePage><Access /></SafePage>} />
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
    </ErrorBoundary>
  );
}
