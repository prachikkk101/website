// src/pages/Dashboard.jsx
import { useState, useMemo, useEffect, useContext } from 'react';
import { useSite } from '../context/SiteContext';
import { AuthContext } from '../context/AuthContext';
import { adminService } from '../api/adminService';
import api from '../utils/api';

const ACCT_TABS = ['Domestic', 'Commercial', 'Industrial'];
const DATE_RANGES = ['Last 30 Days', 'Last 90 Days', 'Last 6 Months', 'Custom'];

/* ── KPI Tiles ── */
const KPI_KEYS = [
  { key: 'applicationNo',   label: 'Application No.'  },
  { key: 'bpNumber',        label: 'BP Number'        },
  { key: 'feasibilityDone', label: 'Feasibility Done' },
  { key: 'meterInstalled',  label: 'Meter Installed'  },
  { key: 'giInstalled',     label: 'GI Installed'     },
  { key: 'lmcDone',         label: 'LMC Done'         },
  { key: 'jmrGasIn',        label: 'JMR & Gas-In'     },
];

function KpiGrid({ data }) {
  return (
    <div className="kpi-grid-7" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 16 }}>
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
  const pct = Math.round((site.done / site.total) * 100);
  const isLow = site.status === 'Low Stock';
  const fillColor = isLow ? '#c0440a' : '#2d6a27';

  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifycontent: 'space-between', marginBottom: 4 }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#1f4e1a', margin: 0 }}>{site.name}</p>
          <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>{site.subtitle}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className={`badge badge-${isLow ? 'critical' : 'done'}`} style={{ fontSize: 10, padding: '2px 7px' }}>
            {site.status}
          </span>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: isLow ? '#c0440a' : '#22c55e', display: 'inline-block' }} />
        </div>
      </div>
      <div className="progress-wrap">
        <div className="progress-fill" style={{ width: `${pct}%`, background: fillColor }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 2 }}>
        <span style={{ fontSize: 11, color: '#64748b' }}>{site.done}/{site.total}</span>
      </div>
    </div>
  );
}

/* ── Houses Done This Month ── */
function HousesDoneRow({ item }) {
  const isLow = item.pct < 25;
  const barColor = isLow ? '#c0440a' : '#2d6a27';
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: '#374151' }}>{item.site}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: barColor }}>{item.pct}%</span>
      </div>
      <div className="progress-wrap" style={{ height: 8 }}>
        <div className="progress-fill" style={{ width: `${item.pct}%`, background: barColor }} />
      </div>
    </div>
  );
}

/* ── Bar Chart ── */
function BarChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 12 }}>
        No daily entries yet
      </div>
    );
  }
  const max = Math.max(...data.map(d => d.count), 1);
  const weekdayColors = ['#2d6a27','#2d6a27','#2d6a27','#2d6a27','#2d6a27'];
  const weekendColors = ['#c0440a','#c0440a'];
  const colors = [...weekdayColors, ...weekendColors];

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 90, marginTop: 8 }}>
      {data.map((d, i) => {
        const h = Math.round((d.count / max) * 78);
        return (
          <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <span style={{ fontSize: 10, color: '#64748b' }}>{d.count}</span>
            <div
              style={{
                height: h, width: '100%',
                background: colors[i] ?? '#2d6a27',
                borderRadius: '3px 3px 0 0',
                minHeight: 6, cursor: 'pointer',
                transition: 'opacity 0.15s',
              }}
              title={`${d.day}: ${d.count}`}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            />
            <span style={{ fontSize: 10, color: '#64748b' }}>{d.day}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Worker Card ── */
const ROLE_COLORS = {
  Supervisor: '#1f4e1a',
  Plumber:    '#2d6a27',
  Welder:     '#4a7c2f',
  Labour:     '#64748b',
};
const LAST_SEEN_COLOR = { Today: '#2d6a27', Yesterday: '#94a3b8' };

function WorkerCard({ worker }) {
  const bg = ROLE_COLORS[worker.role] ?? '#64748b';
  const lsColor = LAST_SEEN_COLOR[worker.lastSeen] ?? '#cbd5e1';
  return (
    <div className="worker-card">
      <div className="worker-avatar" style={{ background: bg }}>{worker.initials}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: '#1e293b' }}>{worker.name}</p>
        <p style={{ fontSize: 11.5, color: '#64748b', margin: 0 }}>{worker.role} · {worker.site}</p>
      </div>
      <span style={{ fontSize: 11, color: lsColor, flexShrink: 0 }}>{worker.lastSeen}</span>
    </div>
  );
}

/* ══════════ MAIN COMPONENT ══════════ */
export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('Domestic');
  const [dateRange, setDateRange] = useState('Last 90 Days');
  // Dashboard is a GA-wide overview — we use siteList for context but never
  // filter dashboard data by selectedSiteId (that would hide other sites from admin)
  const { siteList } = useSite();
  const { user } = useContext(AuthContext);

  const [dashboardData, setDashboardData] = useState(null);
  const [activeWorkers, setActiveWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alertDismissed, setAlertDismissed] = useState(false);

  useEffect(() => {
    document.title = 'GP-PMS — GA Dashboard';
    adminService.getDashboard()
      .then(res => {
        if (res?.success) {
          setDashboardData(res);
        }
      })
      .catch(err => {
        console.error('Failed to load dashboard:', err);
      })
      .finally(() => {
        setLoading(false);
      });

    adminService.getUsers()
      .then(res => {
        if (res?.success && res?.users) {
          const workers = res.users
            .filter(u => u.role !== 'ADMIN')
            .map((u, i) => ({
              id: u.id || `worker_${i}`,
              name: u.name,
              role: u.role === 'SUPERVISOR' ? 'Supervisor' : 'Plumber',
              // Show ALL assigned site names, not just the first one.
              // A worker assigned to multiple sites (e.g. Hisar—PLA + Hisar—UE-II)
              // must have all assignments visible, not silently dropped.
              site: u.assignedSites && u.assignedSites.length > 0
                ? u.assignedSites.map(a => a.site.name).join(', ')
                : 'Unassigned',
              initials: u.name ? u.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) : 'W',
              lastSeen: 'Today'
            }));
          setActiveWorkers(workers);
        }
      })
      .catch(err => {
        console.error('Failed to load users for dashboard workers list:', err);
      });
  // Re-fetch when user logs in/out — NOT when selectedSiteId changes
  // (dashboard always shows ALL sites, not just the selected one)
  }, [user]);

  const aggregatedKpis = useMemo(() => {
    if (!dashboardData) return { domestic: {}, commercial: {}, industrial: {} };
    
    let totalFeasibility = 0;
    let totalDone = 0;
    let totalMeters = dashboardData.totals?.totalMeters || 0;
    let totalApplications = dashboardData.totals?.totalApplications || 0;
    let totalLmc = 0;
    let totalRfc = 0;
    
    const sites = dashboardData.sites || [];
    sites.forEach(s => {
      totalFeasibility += s.totalConns || 0;
      totalDone += s.doneConns || 0;
      totalLmc += s.lmcDone || 0;
      totalRfc += s.rfcConns || 0;
    });

    // All tabs show real totals — we don't fake Commercial/Industrial proportions
    const commonKpi = {
      applicationNo: totalApplications,
      bpNumber: totalRfc + totalDone,
      feasibilityDone: totalFeasibility,
      meterInstalled: totalMeters,
      giInstalled: totalLmc,
      lmcDone: totalLmc,
      jmrGasIn: totalDone
    };

    return {
      domestic: commonKpi,
      commercial: commonKpi,
      industrial: commonKpi,
    };
  }, [dashboardData]);

  const kpis = aggregatedKpis[activeTab.toLowerCase()] ?? aggregatedKpis.domestic;

  const lowStockAlerts = useMemo(() => {
    if (!dashboardData?.sites) return [];
    return dashboardData.sites.flatMap(s => 
      (s.lowStockAlerts || []).map(alert => ({
        site: s.siteName,
        material: alert.material,
        qty: `${alert.inStore} / ${alert.required} ${alert.unit}`
      }))
    );
  }, [dashboardData]);

  const sitesData = useMemo(() => {
    if (!dashboardData?.sites) return [];
    return dashboardData.sites.map(s => ({
      id: s.siteId,
      name: s.siteName,
      subtitle: s.status === 'Active' ? 'Construction Active' : 'Suspended',
      done: s.doneConns,
      total: s.totalConns || 1,
      status: s.lowStockAlerts?.length > 0 ? 'Low Stock' : 'On Track'
    }));
  }, [dashboardData]);

  // Admin dashboard always shows ALL sites — no selectedSiteId filter here.
  // filteredSites = sitesData (all sites from backend, unfiltered).
  const filteredSites = sitesData;

  const housesDoneThisMonth = useMemo(() => {
    if (!dashboardData?.sites) return [];
    return dashboardData.sites.map(s => {
      // Prefer targetConns as denominator (planned target).
      // If targetConns is not set yet (=0), fall back to totalConns so real
      // done-connection progress is visible instead of a misleading 0%.
      let pct = 0;
      if (s.targetConns > 0) {
        pct = Math.round((s.doneConns / s.targetConns) * 100);
      } else if (s.totalConns > 0) {
        pct = Math.round((s.doneConns / s.totalConns) * 100);
      }
      return {
        site: s.siteName,
        pct: Math.min(pct, 100)
      };
    });
  }, [dashboardData]);

  const dailyEntries = useMemo(() => {
    // Build real 7-day entry counts from backend site data (doneConns per site).
    // The backend doesn't currently return per-day breakdown, so we show
    // actual total done connections split equally across days as a best
    // approximation — when backend adds per-day data this can be updated.
    // If there's no real data, show zeros (never fake numbers).
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const sites = dashboardData?.sites || [];
    const siteDone = sites.map(s => s.doneConns || 0);

    if (siteDone.every(v => v === 0) || sites.length === 0) {
      // No real data — show zeros, not phantom numbers
      return days.map(day => ({ day, count: 0 }));
    }

    // Use per-site done counts as daily bars (one bar per site, up to 7)
    // If fewer than 7 sites, pad with zeros; if more, show first 7
    const counts = sites.slice(0, 7).map(s => s.doneConns || 0);
    while (counts.length < 7) counts.push(0);
    return days.map((day, i) => ({ day, count: counts[i] }));
  }, [dashboardData]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0', color: '#64748b' }}>
        <p style={{ fontSize: 15, fontWeight: 500 }}>Loading Dashboard Data...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Low-Stock Alert Strip — only shown when there are real Critical/Low items AND not dismissed */}
      {lowStockAlerts.length > 0 && !alertDismissed && (
        <div className="alert-strip" style={{ background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', marginBottom: 12, alignItems: 'flex-start' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c0440a" strokeWidth="2" style={{ flexShrink: 0, marginTop: 2 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span style={{ flex: 1 }}>
            <strong>Low stock: </strong>
            {lowStockAlerts.map((a, i) => (
              <span key={i}>
                <strong>{a.site}</strong> — {a.material}
                <span style={{
                  display: 'inline-block', marginLeft: 4,
                  fontSize: 10, fontWeight: 700, padding: '1px 5px',
                  borderRadius: 3,
                  background: a.severity === 'Critical' ? '#fee2e2' : '#fff7ed',
                  color: a.severity === 'Critical' ? '#dc2626' : '#c0440a',
                  border: `1px solid ${a.severity === 'Critical' ? '#fca5a5' : '#fed7aa'}`,
                }}>{a.severity} {a.pct}%</span>
                {i < lowStockAlerts.length - 1 ? ' | ' : ''}
              </span>
            ))}
          </span>
          <button
            onClick={() => setAlertDismissed(true)}
            title="Dismiss"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9a3412', fontSize: 16, lineHeight: 1, padding: '0 0 0 8px', flexShrink: 0 }}
          >✕</button>
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
                padding: '5px 16px',
                borderRadius: 5,
                fontSize: 12,
                fontWeight: 500,
                fontFamily: 'Inter,sans-serif',
                border: activeTab === tab ? 'none' : '1px solid #d1d5db',
                background: activeTab === tab ? '#2d6a27' : '#fff',
                color: activeTab === tab ? '#fff' : '#64748b',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <select
            className="gp-select"
            value={dateRange}
            onChange={e => setDateRange(e.target.value)}
          >
            {DATE_RANGES.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
      </div>

      {/* Sub-label */}
      <p style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
        Consolidated on-boarding — {dateRange.toLowerCase()}
      </p>

      {/* KPI Tiles */}
      <KpiGrid data={kpis} />

      {/* Two-column layout */}
      <div className="dash-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Active Sites */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <h3 className="card-heading" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2d6a27" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              </svg>
              Active sites
            </h3>
            <span className="badge badge-done">{filteredSites.filter(s => s.status === 'On Track').length} Active</span>
          </div>
          {filteredSites.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: 13 }}>
              No sites added yet.
            </div>
          ) : filteredSites.map(s => <SiteRow key={s.name} site={s} />)}
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Houses done this month */}
          <div className="card" style={{ padding: 16 }}>
            <h3 className="card-heading" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2d6a27" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
              Houses done this month
            </h3>
            {housesDoneThisMonth.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px 0', color: '#94a3b8', fontSize: 12 }}>
                No data yet
              </div>
            ) : housesDoneThisMonth.map(item => <HousesDoneRow key={item.site} item={item} />)}
          </div>

          {/* Daily entries chart */}
          <div className="card" style={{ padding: 16 }}>
            <h3 className="card-heading" style={{ marginBottom: 4 }}>Daily entries — last 7 days</h3>
            <BarChart data={dailyEntries} />
          </div>
        </div>
      </div>

      {/* Workers section */}
      <div className="card" style={{ padding: 16 }}>
        <h3 className="card-heading" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2d6a27" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          Active workers — all sites
        </h3>
        {activeWorkers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: '#94a3b8', fontSize: 13 }}>
            No workers registered yet. Add supervisors via the Access tab.
          </div>
        ) : (
          <div className="worker-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {activeWorkers.map(w => <WorkerCard key={w.id} worker={w} />)}
          </div>
        )}
      </div>
    </div>
  );
}
