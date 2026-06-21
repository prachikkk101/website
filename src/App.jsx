// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SiteProvider } from './context/SiteContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Inventory from './pages/Inventory';
import PELaying from './pages/PELaying';
import ICWork from './pages/ICWork';
import Placeholder from './pages/Placeholder';

export default function App() {
  return (
    <SiteProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route element={<Layout />}>
            <Route path="/dashboard"  element={<Dashboard />} />
            <Route path="/customers"  element={<Customers />} />
            <Route path="/inventory"  element={<Inventory />} />
            <Route path="/pe-laying"  element={<PELaying />} />
            <Route path="/ic-work"    element={<ICWork />} />
            <Route path="/reports"    element={<Placeholder title="Reports"  icon="📊" />} />
            <Route path="/masters"    element={<Placeholder title="Masters"  icon="⚙️" />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SiteProvider>
  );
}
