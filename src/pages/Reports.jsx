// src/pages/Reports.jsx
import { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useToast } from '../components/Toast';
import { useSite } from '../context/SiteContext';
import api from '../utils/api';

function fmtDateTime(iso) {
  try {
    return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

function fmtDate(d) {
  try { return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

const todayStr = () => new Date().toISOString().split('T')[0];

export default function Reports() {
  const { showToast } = useToast();
  const { siteList }  = useSite();

  const sites = useMemo(() => {
    return ['All Sites', ...siteList.map(s => s.name || s.label)];
  }, [siteList]);

  const [reports,    setReports]    = useState([]);
  const [filterSite, setFilterSite] = useState('All Sites');
  const [filterDate, setFilterDate] = useState('');
  const [filterQ,    setFilterQ]    = useState('');

  // Post form state
  const [pSite,     setPSite]     = useState('');
  const [pDate,     setPDate]     = useState(todayStr());
  const [pWork,     setPWork]     = useState('');
  const [pIssues,   setPIssues]   = useState('');
  const [pErr,      setPErr]      = useState('');
  const [pPosting,  setPPosting]  = useState(false);
  const [showDeleteId, setShowDeleteId] = useState(null);

  useEffect(() => {
    document.title = 'GP-PMS — Reports';
    api.get('/daily-reports')
      .then(res => {
        if (res.data?.success && res.data?.reports) {
          const mapped = res.data.reports.map(r => ({
            id: r.id,
            site: r.siteName,
            date: r.date,
            workDone: r.workDone,
            issues: r.issues || '',
            postedBy: r.postedBy,
            postedAt: r.postedAt
          }));
          setReports(mapped);
        }
      })
      .catch(err => {
        console.error('Failed to load reports from backend:', err);
        setReports([]);
      });
  }, []);

  useEffect(() => {
    if (sites.length > 1 && !pSite) {
      setPSite(sites[1]);
    }
  }, [sites, pSite]);

  const session = (() => {
    try { return JSON.parse(localStorage.getItem('gppms_session') || '{}'); } catch { return {}; }
  })();
  const postedByName = session.name || 'Admin';

  const filtered = useMemo(() => (reports || []).filter(r => {
    if (filterSite !== 'All Sites' && r.site !== filterSite) return false;
    if (filterDate && r.date !== filterDate) return false;
    if (filterQ && !r.workDone?.toLowerCase().includes(filterQ.toLowerCase()) &&
        !r.site?.toLowerCase().includes(filterQ.toLowerCase())) return false;
    return true;
  }), [reports, filterSite, filterDate, filterQ]);

  async function handlePost() {
    if (!pWork.trim()) { setPErr('Work done description is required.'); return; }
    setPErr('');
    setPPosting(true);
    try {
      const response = await api.post('/daily-reports', {
        siteName: pSite,
        date: pDate,
        workDone: pWork.trim(),
        issues: pIssues.trim() || null,
      });

      if (response.data?.success && response.data?.report) {
        const r = response.data.report;
        const newReport = {
          id: r.id,
          site: r.siteName,
          date: r.date,
          workDone: r.workDone,
          issues: r.issues || '',
          postedBy: r.postedBy,
          postedAt: r.postedAt
        };
        setReports(prev => [newReport, ...prev]);
        setPWork(''); setPIssues('');
        showToast('✓ Report posted successfully');
      }
    } catch (err) {
      console.error('Failed to post report:', err);
      showToast('❌ Failed to post report. Please try again.');
    } finally {
      setPPosting(false);
    }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/daily-reports/${id}`);
      setReports(prev => prev.filter(r => r.id !== id));
      showToast('✓ Report deleted successfully');
    } catch (err) {
      console.error('Failed to delete report:', err);
      showToast('❌ Failed to delete report.');
    } finally {
      setShowDeleteId(null);
    }
  }

  function handleExport() {
    const data = filtered.map(r => ({
      Date: r.date,
      Site: r.site,
      'Work Done': r.workDone,
      'Issues': r.issues || '—',
      'Posted By': r.postedBy,
      'Posted At': fmtDateTime(r.postedAt),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{ wch: 12 }, { wch: 18 }, { wch: 60 }, { wch: 40 }, { wch: 16 }, { wch: 22 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Daily Reports');
    XLSX.writeFile(wb, `GP_PMS_DailyReports_${todayStr()}.xlsx`);
  }

  const charCount = pWork.length;
  const MAX_CHARS = 300;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1f4e1a', margin: 0 }}>Daily Progress Reports</h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>Supervisors post daily site updates</p>
        </div>
        <button onClick={handleExport} style={{ height: 34, background: '#2d6a27', color: '#fff', border: 'none', borderRadius: 5, padding: '0 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          ↓ Export Excel ({filtered.length})
        </button>
      </div>

      {/* Post New Report */}
      <div className="card section-block" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1f4e1a', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          📝 Post New Report
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Site *</label>
            <select value={pSite} onChange={e => setPSite(e.target.value)} className="gp-select" style={{ width: '100%' }}>
              {sites.slice(1).map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Date *</label>
            <input type="date" value={pDate} onChange={e => setPDate(e.target.value)} className="gp-input" style={{ width: '100%' }} />
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Work Done Today *</label>
            <span style={{ fontSize: 11, color: charCount > MAX_CHARS ? '#ef4444' : '#94a3b8' }}>{charCount} / {MAX_CHARS}</span>
          </div>
          <textarea value={pWork} onChange={e => setPWork(e.target.value.slice(0, MAX_CHARS))}
            placeholder="e.g. Laid 120 mtr of D63 pipe in Uttam Nagar. Completed 8 house connections in Guru Nanak Nagar. 3 workers on site."
            rows={3}
            style={{ width: '100%', border: `1px solid ${pErr ? '#ef4444' : '#d1d5db'}`, borderRadius: 6, padding: '10px 12px', fontSize: 13, resize: 'vertical', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
          />
          {pErr && <p style={{ fontSize: 11, color: '#ef4444', margin: '3px 0 0' }}>{pErr}</p>}
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Issues / Blockers (optional)</label>
          <textarea value={pIssues} onChange={e => setPIssues(e.target.value)}
            placeholder="e.g. Material shortage for 32mm pipe. Will need restock by Thursday."
            rows={2}
            style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '10px 12px', fontSize: 13, resize: 'vertical', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <button onClick={handlePost} disabled={pPosting}
          style={{ width: '100%', padding: '12px', background: '#2d6a27', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: pPosting ? 0.7 : 1 }}>
          {pPosting ? 'Posting...' : '📤 Post Report'}
        </button>
      </div>

      {/* Filter bar */}
      <div className="card section-block" style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <select value={filterSite} onChange={e => setFilterSite(e.target.value)} className="gp-select" style={{ minWidth: 160 }}>
          {sites.map(s => <option key={s}>{s}</option>)}
        </select>
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="gp-input" style={{ width: 140 }} />
        <input value={filterQ} onChange={e => setFilterQ(e.target.value)} placeholder="Search reports…" className="gp-input" style={{ flex: 1, minWidth: 160 }} />
        {(filterSite !== 'All Sites' || filterDate || filterQ) && (
          <button onClick={() => { setFilterSite('All Sites'); setFilterDate(''); setFilterQ(''); }}
            style={{ height: 32, padding: '0 12px', background: '#f1f5f9', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}>
            Clear
          </button>
        )}
        <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 'auto' }}>{filtered.length} report{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Reports feed */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>
          <div style={{ fontSize: 40 }}>📋</div>
          <div style={{ marginTop: 10, fontSize: 15, fontWeight: 600 }}>No reports found</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Try adjusting your filters or post a new report above</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(r => (
            <div key={r.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
              {/* Card header */}
              <div style={{ background: '#f0f7ee', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '8px 8px 0 0' }}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#1f4e1a' }}>🏗 {r.site}</span>
                  <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 10 }}>Posted by: {r.postedBy}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>{fmtDate(r.date)}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{fmtDateTime(r.postedAt).split(',')[1]?.trim() || ''}</div>
                  </div>
                  {/* Delete button */}
                  <button onClick={() => setShowDeleteId(r.id)}
                    title="Delete report"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: 4, color: '#94a3b8', fontSize: 15, display: 'flex', alignItems: 'center' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#dc2626'}
                    onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
                  >🗑</button>
                </div>
              </div>
              {/* Card body */}
              <div style={{ padding: '12px 16px' }}>
                <p style={{ margin: 0, fontSize: 13, color: '#1e293b', lineHeight: 1.65 }}>
                  <span style={{ fontWeight: 600, color: '#64748b', fontSize: 11 }}>Work done: </span>{r.workDone}
                </p>
                {r.issues && (
                  <div style={{ marginTop: 10, padding: '8px 12px', background: '#fff7ed', borderRadius: 4, fontSize: 12, color: '#9a3412', borderLeft: '3px solid #c0440a' }}>
                    <strong>Issues:</strong> {r.issues}
                  </div>
                )}
              </div>

              {/* Inline delete confirm */}
              {showDeleteId === r.id && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.95)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, zIndex: 10, borderRadius: 8 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>Delete this report?</p>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setShowDeleteId(null)} style={{ padding: '8px 20px', background: '#f1f5f9', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>No</button>
                    <button onClick={() => handleDelete(r.id)} style={{ padding: '8px 20px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Yes, Delete</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
