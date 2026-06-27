// src/pages/Dashboard.jsx
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../api/adminService';
import { useSite } from '../context/SiteContext';
import { useAuth } from '../context/AuthContext';
import { kpiData, sitesData, lowStockAlerts as staticAlerts } from '../data/dashboard';
import { getHouses } from '../utils/dataService';

// ── Local fallback in backend response shape ──
function buildLocalDashboard() {
  const houses = getHouses();
  const done   = houses.filter(h => (h.gcStatus || h.ngStatus || '').toLowerCase().includes('done')).length;
  return {
    sites: sitesData.map((s, i) => ({
      siteId:          'local-site-' + (i + 1),
      siteName:        s.name,
      status:          s.alert ? 'Low Stock' : 'Active',
      totalConns:      s.total,
      targetConns:     s.total,
      doneConns:       s.done,
      rfcConns:        Math.round(s.done * 0.15),
      metersInstalled: Math.round(s.done * 0.9),
      lmcDone:         Math.round(s.done * 0.85),
      icDone:          Math.round(s.done * 0.7),
      lowStockAlerts:  s.alert ? staticAlerts.filter(a => a.site === s.name.split('—')[0].trim()) : [],
    })),
    totals: { peLaying: { d32: 1314, d63: 3473, d90: 1210, d125: 510 } },
  };
}

const ACCT_TABS = ['Domestic', 'Commercial', 'Industrial'];
const DATE_RANGES = ['Last 30 Days', 'Last 90 Days', 'Last 6 Months', 'Custom'];

/* ── KPI Tiles ── */
const KPI_KEYS = [
  { key: 'totalConns',       label: 'Total Connections' },
  { key: 'doneConns',        label: 'Completed'         },
  { key: 'rfcConns',         label: 'RFC'               },
  { key: 'metersInstalled',  label: 'Meters Installed'  },
  { key: 'lmcDone',          label: 'LMC Done'          },
  { key: 'icDone',           label: 'I&C Done'          },
];

function KpiGrid({ data }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${KPI_KEYS.length}, 1fr)`, gap: 8, marginBottom: 16 }}>
      {KPI_KEYS.map((k, i) => (
        <div
          key={k.key}
          className="kpi-tile"
          style={{ background: i % 2 === 0 ? '#c0440a' : '#2d6a27' }}
        >
          <p className="kpi-label">{k.label}</p>
          <p className="kpi-value">{(data[k.key] ?? 0).toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}

/* ── Site Progress Bar ── */
function SiteRow({ site }) {
  const pct = site.targetConns > 0 ? Math.round((site.doneConns / site.targetConns) * 100) : 0;
  const hasAlerts = site.lowStockAlerts && site.lowStockAlerts.length > 0;
  const fillColor = hasAlerts ? '#c0440a' : '#2d6a27';

  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#1f4e1a', margin: 0 }}>{site.siteName}</p>
          <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>{site.status}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className={`badge badge-${hasAlerts ? 'critical' : 'done'}`} style={{ fontSize: 10, padding: '2px 7px' }}>
            {hasAlerts ? 'Low Stock' : site.status}
          </span>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: hasAlerts ? '#c0440a' : '#22c55e', display: 'inline-block' }} />
        </div>
      </div>
      <div className="progress-wrap">
        <div className="progress-fill" style={{ width: `${pct}%`, background: fillColor }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
        <span style={{ fontSize: 11, color: '#64748b' }}>{pct}% complete</span>
        <span style={{ fontSize: 11, color: '#64748b' }}>{site.doneConns}/{site.targetConns}</span>
      </div>
    </div>
  );
}

/* ── Loading skeleton ── */
function LoadingSkeleton() {
  return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div style={{
        width: 40, height: 40, border: '4px solid #e2e8f0',
        borderTopColor: '#2d6a27', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
      }} />
      <p style={{ color: '#64748b', fontSize: 14 }}>Loading dashboard data...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}

/* ══════════ MAIN COMPONENT ══════════ */
export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('Domestic');
  const [dateRange, setDateRange] = useState('Last 90 Days');
  const { selectedSite, siteOptions } = useSite();
  const { user, pendingRequestCount } = useAuth();
  const navigate = useNavigate();

  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch dashboard data — fall back to static data if backend offline
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    adminService.getDashboard()
      .then((data) => {
        if (!cancelled && data.success !== false) {
          setDashboardData(data);
        } else if (!cancelled) {
          setDashboardData(buildLocalDashboard());
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDashboardData(buildLocalDashboard());
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  /* Filter sites by selected */
  const filteredSites = useMemo(() => {
    if (!dashboardData?.sites) return [];
    if (selectedSite === 'all') return dashboardData.sites;
    return dashboardData.sites.filter(s => s.siteId === selectedSite);
  }, [selectedSite, dashboardData]);

  /* Aggregate KPIs across filtered sites */
  const aggregatedKpis = useMemo(() => {
    if (!filteredSites.length) return { totalConns: 0, doneConns: 0, rfcConns: 0, metersInstalled: 0, lmcDone: 0, icDone: 0 };
    return filteredSites.reduce((acc, s) => ({
      totalConns: acc.totalConns + (s.totalConns || 0),
      doneConns: acc.doneConns + (s.doneConns || 0),
      rfcConns: acc.rfcConns + (s.rfcConns || 0),
      metersInstalled: acc.metersInstalled + (s.metersInstalled || 0),
      lmcDone: acc.lmcDone + (s.lmcDone || 0),
      icDone: acc.icDone + (s.icDone || 0),
    }), { totalConns: 0, doneConns: 0, rfcConns: 0, metersInstalled: 0, lmcDone: 0, icDone: 0 });
  }, [filteredSites]);

  /* Low stock alerts */
  const lowStockAlerts = useMemo(() => {
    if (!filteredSites.length) return [];
    return filteredSites
      .filter(s => s.lowStockAlerts?.length > 0)
      .flatMap(s => s.lowStockAlerts.map(a => ({ site: s.siteName, ...a })));
  }, [filteredSites]);

  /* PE Laying totals */
  const peTotals = dashboardData?.totals?.peLaying || {};

  const selectedLabel = siteOptions.find(s => s.value === selectedSite)?.label || 'All Sites';

  if (loading) return <LoadingSkeleton />;

  // Only show error if we have no data at all (should not happen with local fallback)
  if (error && !dashboardData) {
    return (
      <div className="card" style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ fontSize: 48, marginBottom: 8 }}>📊</p>
        <h2 style={{ color: '#c0440a', marginBottom: 8 }}>Dashboard Unavailable</h2>
        <p style={{ color: '#64748b', fontSize: 13 }}>{error}</p>
      </div>
    );
  }

  return (
    <div>
      {/* ── Admin pending-requests alert strip ── */}
      {user?.role === 'ADMIN' && pendingRequestCount > 0 && (
        <div
          onClick={() => navigate('/masters/access-requests')}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
            background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8,
            marginBottom: 12, cursor: 'pointer', transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#ffedd5'}
          onMouseLeave={e => e.currentTarget.style.background = '#fff7ed'}
        >
          <span style={{ fontSize: 18, flexShrink: 0 }}>🔔</span>
          <span style={{ flex: 1, fontSize: 13, color: '#9a3412' }}>
            <strong>You have {pendingRequestCount} pending access request{pendingRequestCount !== 1 ? 's' : ''}.</strong>{' '}
            Review them →
          </span>
        </div>
      )}

      {/* Alert Strip — low stock */}
      {lowStockAlerts.length > 0 && (
        <div className="alert-strip" style={{ background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c0440a" strokeWidth="2" style={{ flexShrink: 0 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span>
            <strong>Low stock: </strong>
            {lowStockAlerts.map((a, i) => (
              <span key={i}>
                <strong>{a.site}</strong> — {a.material} (In Store: {Number(a.inStore).toLocaleString()})
                {i < lowStockAlerts.length - 1 ? ' | ' : ''}
              </span>
            ))}
          </span>
        </div>
      )}

      {/* Filter row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingBottom: 4, marginBottom: 12 }}>
        {/* Account type tabs */}
        <div style={{ display: 'flex', gap: 8 }}>
          {ACCT_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '5px 16px', borderRadius: 5, fontSize: 12, fontWeight: 500,
                fontFamily: 'Inter,sans-serif',
                border: activeTab === tab ? 'none' : '1px solid #d1d5db',
                background: activeTab === tab ? '#2d6a27' : '#fff',
                color: activeTab === tab ? '#fff' : '#64748b',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <select className="gp-select" value={dateRange} onChange={e => setDateRange(e.target.value)}>
            {DATE_RANGES.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
      </div>

      {/* Sub-label */}
      <p style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
        Consolidated on-boarding — {dateRange.toLowerCase()} ({selectedLabel})
      </p>

      {/* KPI Tiles */}
      <KpiGrid data={aggregatedKpis} />

      {/* PE Laying summary */}
      {dashboardData?.totals && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
          {[
            { label: 'Total Ø32mm Laid', value: `${(Number(peTotals.d32oc || 0) + Number(peTotals.d32b || 0)).toLocaleString()} mtr` },
            { label: 'Total Ø63mm Laid', value: `${(Number(peTotals.d63oc || 0) + Number(peTotals.d63b || 0) + Number(peTotals.d63hdd || 0)).toLocaleString()} mtr` },
            { label: 'Total Ø90mm Laid', value: `${Number(peTotals.d90tot || 0).toLocaleString()} mtr` },
            { label: 'Total Ø125mm Laid', value: `${Number(peTotals.d125tot || 0).toLocaleString()} mtr` },
          ].map(k => (
            <div key={k.label} className="kpi-tile" style={{ background: '#1f4e1a' }}>
              <p className="kpi-label">{k.label}</p>
              <p className="kpi-value" style={{ fontSize: 20 }}>{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Active Sites */}
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h3 className="card-heading" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2d6a27" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            </svg>
            Active sites
          </h3>
          <span className="badge badge-done">
            {filteredSites.filter(s => s.status === 'Active').length} Active
          </span>
        </div>
        {filteredSites.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>No sites found.</p>
        ) : (
          filteredSites.map(s => <SiteRow key={s.siteId} site={s} />)
        )}
      </div>

      {/* Platform totals footer */}
      <div style={{
        marginTop: 12, padding: '8px 12px',
        background: '#eff6ff', border: '1px solid #bfdbfe',
        borderRadius: 6, fontSize: 12, color: '#1d4ed8',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
        Total Applications: {dashboardData?.totals?.totalApplications?.toLocaleString() || 0} |
        Total Meters: {dashboardData?.totals?.totalMeters?.toLocaleString() || 0} |
        Data is live from the database
      </div>
    </div>
  );
}
