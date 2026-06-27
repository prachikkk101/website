// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SiteProvider } from './context/SiteContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Inventory from './pages/Inventory';
import PELaying from './pages/PELaying';
import ICWork from './pages/ICWork';
import Placeholder from './pages/Placeholder';
import Login from './pages/Login';
import Masters from './pages/Masters';
import MySite from './pages/MySite';

/* Redirect already-logged-in users away from /login */
function LoginOrRedirect() {
  try {
    const session = JSON.parse(localStorage.getItem('gppms_session') || 'null');
    if (session?.token) {
      return <Navigate to={session.role === 'ADMIN' ? '/dashboard' : '/my-site'} replace />;
    }
  } catch { /* ignore */ }
  return <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <SiteProvider>
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginOrRedirect />} />

            {/* Protected routes */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }>
              <Route path="/dashboard"               element={<Dashboard />} />
              <Route path="/customers"               element={<Customers />} />
              <Route path="/inventory"               element={<Inventory />} />
              <Route path="/pe-laying"               element={<PELaying />} />
              <Route path="/ic-work"                 element={<ICWork />} />
              <Route path="/reports"                 element={<Placeholder title="Reports"  icon="📊" />} />
              {/* Masters — two sub-paths both handled by Masters.jsx via defaultTab prop */}
              <Route path="/masters"                 element={<Masters />} />
              <Route path="/masters/access-requests" element={<Masters defaultTab="access-requests" />} />
              {/* Worker/Supervisor view */}
              <Route path="/my-site"                 element={<MySite />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </SiteProvider>
    </AuthProvider>
  );
}
