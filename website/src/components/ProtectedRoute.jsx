// src/components/ProtectedRoute.jsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#f0f4f0',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 40, height: 40, border: '4px solid #e2e8f0',
            borderTopColor: '#2d6a27', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
          }} />
          <p style={{ color: '#64748b', fontSize: 14 }}>Loading GP-PMS...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Optional role check
  if (roles && user && !roles.includes(user.role)) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#f0f4f0',
      }}>
        <div className="card" style={{ padding: 40, textAlign: 'center', maxWidth: 400 }}>
          <p style={{ fontSize: 48, marginBottom: 8 }}>🚫</p>
          <h2 style={{ color: '#c0440a', marginBottom: 8 }}>Access Denied</h2>
          <p style={{ color: '#64748b', fontSize: 13 }}>
            You do not have permission to access this page.
            Required role: <strong>{roles.join(' or ')}</strong>
          </p>
        </div>
      </div>
    );
  }

  return children;
}
