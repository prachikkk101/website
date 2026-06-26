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
import Register from './pages/Register';
import AccessRequests from './pages/Admin/AccessRequests';

export default function App() {
  return (
    <AuthProvider>
      <SiteProvider>
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected routes */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }>
              <Route path="/dashboard"  element={<Dashboard />} />
              <Route path="/customers"  element={<Customers />} />
              <Route path="/inventory"  element={<Inventory />} />
              <Route path="/pe-laying"  element={<PELaying />} />
              <Route path="/ic-work"    element={<ICWork />} />
              <Route path="/reports"    element={<Placeholder title="Reports"  icon="📊" />} />
              <Route path="/masters"    element={<Placeholder title="Masters"  icon="⚙️" />} />
              <Route path="/admin/requests" element={<AccessRequests />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </SiteProvider>
    </AuthProvider>
  );
}
