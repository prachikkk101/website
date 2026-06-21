// src/pages/Dashboard.jsx
import { useState, useMemo } from 'react';
import { kpiData, sitesData, housesDoneThisMonth, dailyEntries, activeWorkers, lowStockAlerts } from '../data/dashboard';
import { useSite } from '../context/SiteContext';

const ACCT_TABS = ['Domestic', 'Commercial', 'Industrial', 'CNG'];
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
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 16 }}>
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
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
  const max = Math.max(...data.map(d => d.count));
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
  const { selectedSite } = useSite();

  const data = kpiData[activeTab.toLowerCase()] ?? kpiData.domestic;

  /* Filter sites by selected */
  const filteredSites = useMemo(() => {
    if (selectedSite === 'all') return sitesData;
    const siteMap = { khanna: 'Khanna', uenii: 'UE-II', pla: 'PLA', kohara: 'Kohara' };
    const match = siteMap[selectedSite] ?? '';
    return sitesData.filter(s => s.name.toLowerCase().includes(match.toLowerCase()));
  }, [selectedSite]);

  return (
    <div>
      {/* Alert Strip */}
      <div className="alert-strip" style={{ background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c0440a" strokeWidth="2" style={{ flexShrink: 0 }}>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <span>
          <strong>Low stock: </strong>
          {lowStockAlerts.map((a, i) => (
            <span key={i}>
              <strong>{a.site}</strong> — {a.material} ({a.qty})
              {i < lowStockAlerts.length - 1 ? ' | ' : ''}
            </span>
          ))}
        </span>
      </div>

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
        Consolidated on-boarding — {dateRange.toLowerCase()} ({SITE_OPTIONS_LABEL[selectedSite] ?? 'All Sites'})
      </p>

      {/* KPI Tiles */}
      <KpiGrid data={data} />

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Active Sites */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <h3 className="card-heading" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2d6a27" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              </svg>
              Active sites
            </h3>
            <span className="badge badge-done">{filteredSites.filter(s => s.status === 'Active').length} Active</span>
          </div>
          {filteredSites.map(s => <SiteRow key={s.name} site={s} />)}
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
            {housesDoneThisMonth.map(item => <HousesDoneRow key={item.site} item={item} />)}
          </div>

          {/* Daily entries chart */}
          <div className="card" style={{ padding: 16 }}>
            <h3 className="card-heading" style={{ marginBottom: 4 }}>Daily entries — last 7 days (Khanna)</h3>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {activeWorkers.map(w => <WorkerCard key={w.id} worker={w} />)}
        </div>
        <div style={{
          marginTop: 12, padding: '8px 12px',
          background: '#eff6ff', border: '1px solid #bfdbfe',
          borderRadius: 6, fontSize: 12, color: '#1d4ed8',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          Export downloads all visible table data as a formatted Excel file
        </div>
      </div>
    </div>
  );
}

/* label lookup for sub-heading */
const SITE_OPTIONS_LABEL = {
  all:    'All Sites',
  khanna: 'Khanna — CA-09',
  uenii:  'UE-II — Hisar',
  pla:    'PLA — Hisar',
  kohara: 'Kohara — CA-07',
};
