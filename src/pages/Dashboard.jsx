// src/pages/Dashboard.jsx
import { useState } from 'react';
import { kpiData, sitesData, housesDoneThisMonth, dailyEntries, activeWorkers, lowStockAlerts } from '../data/dashboard';

const acctTabs = ['Domestic', 'Commercial', 'Industrial', 'CNG'];
const dateRanges = ['Last 30 Days', 'Last 90 Days', 'Last 6 Months', 'Custom'];
const siteOptions = ['All Sites', 'Khanna CA-09', 'UE-II Hisar', 'PLA Hisar', 'Kohara CA-07'];

const kpiKeys = [
  { key: 'applicationNo', label: 'Application No.' },
  { key: 'bpNumber', label: 'BP Number' },
  { key: 'feasibilityDone', label: 'Feasibility Done' },
  { key: 'meterInstalled', label: 'Meter Installed' },
  { key: 'giInstalled', label: 'GI Installed' },
  { key: 'lmcDone', label: 'LMC Done' },
  { key: 'jmrGasIn', label: 'JMR & Gas-In' },
];

function KpiTile({ label, value, index }) {
  const isAccent = index % 2 === 0;
  const bg = isAccent ? '#c0440a' : '#2d6a27';
  return (
    <div
      className="kpi-tile rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-default select-none"
      style={{ background: bg, minHeight: 110 }}
    >
      <p className="text-orange-100 text-xs font-medium mb-2 leading-tight">{label}</p>
      <p className="text-white font-extrabold text-3xl tracking-tight">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function SiteBar({ site }) {
  const pct = Math.round((site.done / site.total) * 100);
  const isLow = site.status === 'Low Stock';
  const barColor = isLow ? '#c0440a' : '#2d6a27';

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <div>
          <p className="font-semibold text-gray-800 text-sm">{site.name}</p>
          <p className="text-gray-400 text-xs">{site.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: isLow ? '#fee2e2' : '#d1fae5',
              color: isLow ? '#b91c1c' : '#065f46',
            }}
          >
            {site.status}
          </span>
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: isLow ? '#c0440a' : '#22c55e' }}
          />
        </div>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full progress-bar-fill"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
      <div className="flex justify-end mt-0.5">
        <span className="text-xs text-gray-500">{site.done}/{site.total}</span>
      </div>
    </div>
  );
}

function HousesDoneBar({ item }) {
  const isLow = item.pct < 25;
  const barColor = isLow ? '#c0440a' : '#2d6a27';

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-700">{item.site}</span>
        <span className="text-sm font-bold" style={{ color: barColor }}>{item.pct}%</span>
      </div>
      <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full progress-bar-fill"
          style={{ width: `${item.pct}%`, background: barColor }}
        />
      </div>
    </div>
  );
}

function BarChart({ data }) {
  const max = Math.max(...data.map(d => d.count));
  const barColors = ['#2d6a27', '#2d6a27', '#2d6a27', '#2d6a27', '#2d6a27', '#c0440a', '#c0440a'];

  return (
    <div className="flex items-end gap-2 h-28 mt-2">
      {data.map((d, i) => {
        const h = Math.round((d.count / max) * 100);
        return (
          <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-xs text-gray-400 font-medium">{d.count}</span>
            <div
              className="chart-bar w-full rounded-t-sm cursor-pointer"
              style={{ height: `${h}%`, background: barColors[i], minHeight: 8 }}
              title={`${d.day}: ${d.count} entries`}
            />
            <span className="text-xs text-gray-500">{d.day}</span>
          </div>
        );
      })}
    </div>
  );
}

function WorkerAvatar({ worker }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
        style={{ background: worker.color }}
      >
        {worker.initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{worker.name}</p>
        <p className="text-xs text-gray-400">{worker.role} · {worker.site}</p>
      </div>
      <span
        className="text-xs font-medium flex-shrink-0"
        style={{ color: worker.lastSeen === 'Today' ? '#2d6a27' : '#6b7280' }}
      >
        {worker.lastSeen}
      </span>
    </div>
  );
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('Domestic');
  const [dateRange, setDateRange] = useState('Last 90 Days');
  const [site, setSite] = useState('All Sites');

  const data = kpiData[activeTab.toLowerCase()];

  return (
    <div className="space-y-4">
      {/* Low stock alert */}
      <div
        className="alert-banner rounded-xl border px-4 py-3 flex items-start gap-3"
        style={{ background: '#fff7ed', borderColor: '#fed7aa' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c0440a" strokeWidth="2" className="mt-0.5 flex-shrink-0">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <p className="text-sm" style={{ color: '#9a3412' }}>
          <span className="font-semibold">Low stock: </span>
          {lowStockAlerts.map((a, i) => (
            <span key={i}>
              <span className="font-medium">{a.site}</span> — {a.material} ({a.qty})
              {i < lowStockAlerts.length - 1 && ' | '}
            </span>
          ))}
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Account type tabs */}
        <div className="flex gap-1">
          {acctTabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-4 py-1.5 rounded-full text-sm font-semibold transition-all border"
              style={
                activeTab === tab
                  ? { background: '#2d6a27', color: 'white', borderColor: '#2d6a27' }
                  : { background: 'white', color: '#2d6a27', borderColor: '#2d6a27' }
              }
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="ml-auto flex gap-2">
          <select
            value={dateRange}
            onChange={e => setDateRange(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 bg-gray-900 text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            {dateRanges.map(r => <option key={r}>{r}</option>)}
          </select>
          <select
            value={site}
            onChange={e => setSite(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 bg-gray-900 text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            {siteOptions.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Subtitle */}
      <p className="text-sm text-gray-500">
        Consolidated on-boarding — {dateRange.toLowerCase()} ({site})
      </p>

      {/* KPI Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {kpiKeys.map((k, i) => (
          <KpiTile key={k.key} label={k.label} value={data[k.key]} index={i} />
        ))}
      </div>

      {/* Bottom two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Active Sites card */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2d6a27" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              </svg>
              <h3 className="font-bold text-gray-800">Active sites</h3>
            </div>
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: '#d1fae5', color: '#065f46' }}
            >
              {sitesData.filter(s => s.status === 'Active').length} Active
            </span>
          </div>
          {sitesData.map(s => <SiteBar key={s.name} site={s} />)}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Houses done this month */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-4">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2d6a27" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
              <h3 className="font-bold text-gray-800">Houses done this month</h3>
            </div>
            {housesDoneThisMonth.map(item => (
              <HousesDoneBar key={item.site} item={item} />
            ))}
          </div>

          {/* Daily entries chart */}
          <div className="card p-4">
            <h3 className="font-bold text-gray-800 mb-1">Daily entries — last 7 days (Khanna)</h3>
            <BarChart data={dailyEntries} />
          </div>
        </div>
      </div>

      {/* Active workers */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2d6a27" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <h3 className="font-bold text-gray-800">Active workers — all sites</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 mt-2">
          {activeWorkers.map(w => <WorkerAvatar key={w.id} worker={w} />)}
        </div>
        <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-2.5 text-xs text-blue-700 flex items-start gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 flex-shrink-0">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          Export downloads all visible table data as a formatted Excel file
        </div>
      </div>
    </div>
  );
}
