// src/pages/MySite.jsx
// Worker / Supervisor personal site view
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import { useToast } from '../components/Toast';
import { pngService } from '../api/pngService';
import { peLayingService } from '../api/peLayingService';
import { siteService } from '../api/siteService';
import HouseTable from '../components/HouseTable';
import StockTable from '../components/StockTable';

// Static fallbacks
import { houses as staticHouses } from '../data/houses';
import staticStock from '../data/stockData';
import staticPE from '../data/peLaying';

/* ── Small stat card ── */
function StatCard({ label, value, icon, color = '#2d6a27' }) {
  return (
    <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1e293b', lineHeight: 1 }}>{value ?? '—'}</p>
        <p style={{ margin: '3px 0 0', fontSize: 12, color: '#64748b', fontWeight: 500 }}>{label}</p>
      </div>
    </div>
  );
}

/* ── Section heading ── */
function SectionHead({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1f4e1a' }}>{title}</h2>
      {subtitle && <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>{subtitle}</p>}
    </div>
  );
}

/* ══════════ MAIN COMPONENT ══════════ */
export default function MySite() {
  const { user } = useAuth();
  const { sites } = useSite();
  const { showToast } = useToast();

  // Find assigned site (first site from context if backend provides it, else first available)
  const assignedSite = sites.find(s => s.id === user?.siteId) || sites[0] || null;
  const siteName = assignedSite?.name || user?.siteName || 'Your Site';

  // Data state
  const [houses, setHouses]   = useState([]);
  const [stock, setStock]     = useState([]);
  const [peLaying, setPeLaying] = useState([]);
  const [loadingHouses, setLoadingHouses] = useState(true);
  const [loadingStock, setLoadingStock]   = useState(true);
  const [loadingPE, setLoadingPE]         = useState(true);
  const [activeSection, setActiveSection] = useState('connections');

  // ── Fetch houses ──
  const loadHouses = useCallback(async () => {
    setLoadingHouses(true);
    try {
      const siteId = assignedSite?.id;
      const data = siteId
        ? await pngService.getConnections(siteId).catch(() => null)
        : null;
      const list = data
        ? (Array.isArray(data) ? data : (data.connections || data.houses || []))
        : staticHouses;
      setHouses(list);
    } catch {
      setHouses(staticHouses);
    } finally {
      setLoadingHouses(false);
    }
  }, [assignedSite?.id]);

  // ── Fetch stock (read-only) ──
  const loadStock = useCallback(async () => {
    setLoadingStock(true);
    try {
      const siteId = assignedSite?.id;
      const data = siteId
        ? await siteService.getSiteStock(siteId).catch(() => null)
        : null;
      const list = data
        ? (Array.isArray(data) ? data : (data.stock || data.items || []))
        : staticStock;
      setStock(list);
    } catch {
      setStock(staticStock);
    } finally {
      setLoadingStock(false);
    }
  }, [assignedSite?.id]);

  // ── Fetch PE Laying ──
  const loadPE = useCallback(async () => {
    setLoadingPE(true);
    try {
      const siteId = assignedSite?.id;
      const data = siteId
        ? await peLayingService.getPELaying(siteId).catch(() => null)
        : null;
      const list = data
        ? (Array.isArray(data) ? data : (data.entries || data.peLaying || []))
        : staticPE;
      setPeLaying(list);
    } catch {
      setPeLaying(staticPE);
    } finally {
      setLoadingPE(false);
    }
  }, [assignedSite?.id]);

  useEffect(() => {
    loadHouses();
    loadStock();
    loadPE();
  }, [loadHouses, loadStock, loadPE]);

  /* ── Stats ── */
  const totalConns  = houses.length;
  const doneConns   = houses.filter(h => (h.gcStatus || h.ngStatus || '').toLowerCase() === 'done').length;
  const totalPE     = peLaying.length;

  /* ── Section nav tabs ── */
  const sectionTabs = [
    { key: 'connections', label: 'PNG Connections' },
    { key: 'inventory',   label: 'Inventory (Read-only)' },
    { key: 'pe-laying',   label: 'PE Laying' },
  ];

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* ── Welcome header ── */}
      <div style={{
        background: 'linear-gradient(135deg, #1f4e1a 0%, #2d6a27 60%, #4a7c2f 100%)',
        borderRadius: 12,
        padding: '24px 28px',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 500 }}>Welcome back,</p>
          <h1 style={{ margin: '2px 0 6px', color: '#fff', fontSize: 26, fontWeight: 800 }}>
            {user?.name || 'Worker'}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>📍</span>
            <span style={{ color: '#7ec56f', fontWeight: 700, fontSize: 16 }}>{siteName}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{
            display: 'inline-block', padding: '4px 14px', borderRadius: 20,
            background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 12, fontWeight: 700,
          }}>
            {user?.role || 'WORKER'}
          </span>
          <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,0.55)', fontSize: 11 }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* ── KPI stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard label="Total Connections" value={totalConns} icon="🏠" color="#2d6a27" />
        <StatCard label="Completed" value={doneConns} icon="✅" color="#15803d" />
        <StatCard label="Pending" value={totalConns - doneConns} icon="⏳" color="#b45309" />
        <StatCard label="PE Laying Entries" value={totalPE} icon="🔧" color="#1d4ed8" />
      </div>

      {/* ── Section tabs ── */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e2e8f0', marginBottom: 16 }}>
        {sectionTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveSection(tab.key)}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: 'transparent',
              fontSize: 13,
              fontWeight: activeSection === tab.key ? 700 : 500,
              color: activeSection === tab.key ? '#1f4e1a' : '#64748b',
              cursor: 'pointer',
              borderBottom: activeSection === tab.key ? '2px solid #2d6a27' : '2px solid transparent',
              marginBottom: -2,
              fontFamily: 'Inter, sans-serif',
              transition: 'color 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Section content ── */}
      {activeSection === 'connections' && (
        <div>
          <SectionHead title="House PNG Connections" subtitle="Your site's connection records — add and view entries" />
          {loadingHouses ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Loading connections...</div>
          ) : (
            <HouseTable
              initialData={houses}
              readOnly={false}
              siteId={assignedSite?.id}
              onDataChange={loadHouses}
            />
          )}
        </div>
      )}

      {activeSection === 'inventory' && (
        <div>
          <SectionHead title="Site Inventory" subtitle="Stock levels for your site — read only" />
          <div style={{ background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 8, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#92400e' }}>
            <span>ℹ️</span>
            <span>Stock receiving is managed by the admin. You can view current levels here.</span>
          </div>
          {loadingStock ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Loading inventory...</div>
          ) : (
            <StockTable data={stock} readOnly={true} />
          )}
        </div>
      )}

      {activeSection === 'pe-laying' && (
        <div>
          <SectionHead title="PE Laying" subtitle="Pipeline laying progress for your site" />
          {loadingPE ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Loading PE data...</div>
          ) : (
            <div className="card" style={{ overflowX: 'auto' }}>
              {peLaying.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>📋</div>
                  <p style={{ fontWeight: 600, fontSize: 14 }}>No PE Laying entries yet</p>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {['Sr.', 'Laying Date', 'Area', 'Work Status', 'Ø32mm', 'Ø63mm', 'Ø90mm'].map(h => (
                        <th key={h} style={{ padding: '10px 12px', fontSize: 11, fontWeight: 700, color: '#64748b', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {peLaying.map((row, i) => (
                      <tr key={row.id || i}
                        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.background = ''}>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', color: '#64748b' }}>{row.sr || i + 1}</td>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9' }}>{row.layDate || row.layingDate || '—'}</td>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9' }}>{row.area || '—'}</td>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: '#dcfce7', color: '#15803d' }}>
                            {row.status || 'Pending'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9' }}>{(row.d32oc || 0) + (row.d32b || 0)}m</td>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9' }}>{(row.d63oc || 0) + (row.d63b || 0) + (row.d63hdd || 0)}m</td>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9' }}>{row.d90tot || 0}m</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
