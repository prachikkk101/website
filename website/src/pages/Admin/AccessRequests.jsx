import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/api';

export default function AccessRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/access-requests');
      if (res.data.success) {
        setRequests(res.data.requests);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleAction = async (id, action) => {
    try {
      const res = await api.post(`/admin/access-requests/${id}/${action}`);
      if (res.data.success) {
        alert(`Request ${action}d successfully`);
        fetchRequests();
      }
    } catch (err) {
      alert(err.response?.data?.error || `Failed to ${action} request`);
    }
  };

  if (user?.role !== 'ADMIN') {
    return <div style={{ padding: 20 }}>Unauthorized. Only admins can view this page.</div>;
  }

  return (
    <div className="card" style={{ padding: 20 }}>
      <h2 className="card-heading" style={{ marginBottom: 16 }}>Site Access Requests</h2>
      
      {error && <div style={{ color: 'red', marginBottom: 10 }}>{error}</div>}
      
      {loading ? (
        <p>Loading...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f1f5f9', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
              <th style={{ padding: '10px' }}>Date</th>
              <th style={{ padding: '10px' }}>User</th>
              <th style={{ padding: '10px' }}>Role</th>
              <th style={{ padding: '10px' }}>Site</th>
              <th style={{ padding: '10px' }}>Status</th>
              <th style={{ padding: '10px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr><td colSpan="6" style={{ padding: 20, textAlign: 'center' }}>No requests found.</td></tr>
            ) : (
              requests.map(req => (
                <tr key={req.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '10px' }}>{new Date(req.createdAt).toLocaleDateString()}</td>
                  <td style={{ padding: '10px' }}>
                    <strong>{req.user.name}</strong><br/>
                    <span style={{ color: '#64748b', fontSize: 11 }}>{req.user.email}</span>
                  </td>
                  <td style={{ padding: '10px' }}>{req.user.role}</td>
                  <td style={{ padding: '10px' }}>{req.site.name}</td>
                  <td style={{ padding: '10px' }}>
                    <span className={`badge badge-${req.status === 'APPROVED' ? 'done' : req.status === 'REJECTED' ? 'critical' : 'pending'}`}>
                      {req.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px' }}>
                    {req.status === 'PENDING' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button 
                          onClick={() => handleAction(req.id, 'approve')}
                          style={{ padding: '4px 8px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                          Approve
                        </button>
                        <button 
                          onClick={() => handleAction(req.id, 'reject')}
                          style={{ padding: '4px 8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
