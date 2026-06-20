// src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Inventory from './pages/Inventory';
import Placeholder from './pages/Placeholder';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="customers" element={<Customers />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="pe-laying" element={<Placeholder title="PE Laying" icon="🔩" />} />
          <Route path="ic-work" element={<Placeholder title="I&C Work" icon="⚡" />} />
          <Route path="reports" element={<Placeholder title="Reports" icon="📊" />} />
          <Route path="masters" element={<Placeholder title="Masters" icon="⚙️" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
