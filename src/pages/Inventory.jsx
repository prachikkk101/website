import { useState, useMemo, useEffect, useContext } from 'react';
import { exportStockData } from '../utils/exportExcel';
import SlidePanel, { Field, Input, Select, SectionTitle } from '../components/SlidePanel';
import { useToast } from '../components/Toast';
import { AuthContext } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import { stockAPI, dataAPI, uploadAPI } from '../utils/api';
import PhotoViewer from '../components/PhotoViewer';
import { DEFAULT_MATERIALS_BY_CATEGORY, buildAccordionCategories } from '../utils/stockCategories';

const todayStr = () => new Date().toISOString().split('T')[0];

const DEFAULT_COLS = [
  { key: 'unit', label: 'Unit' },
  { key: 'received', label: 'Received' },
  { key: 'used', label: 'Used' },
  { key: 'returned', label: 'Returned' },
  { key: 'available', label: 'Available' },
  { key: 'status', label: 'Status' },
];


function initStore(key, defaults) {
  try {
    const raw = localStorage.getItem('gppms_' + key);
    if (!raw) { localStorage.setItem('gppms_' + key, JSON.stringify(defaults)); return defaults; }
    return JSON.parse(raw);
  } catch { return defaults; }
}

function getSession() {
  try { return JSON.parse(localStorage.getItem('gppms_session') || '{}'); } catch { return {}; }
}

function getStatus(onSite, inStore, open, recv) {
  const total = open + recv;
  const pct = total > 0 ? Math.round(((onSite + inStore) / total) * 100) : 0;
  if (pct >= 50) return { label: 'Good', cls: 'badge-ok', bar: '#16a34a', pct };
  if (pct >= 20) return { label: 'Low', cls: 'badge-low', bar: '#d97706', pct };
  return { label: 'Critical', cls: 'badge-critical', bar: '#dc2626', pct };
}


/* ── Category Accordion for Receive Stock & Return Stock ── */
function CategoryAccordion({
  openCategory, setOpenCategory,
  quantities, setQuantities,
  readOnly = false,
  // stockItems: raw site stock array — used for filtering which materials appear in return mode
  stockItems = null,
  // stockStats: { itemName -> { recv, issued, ret, inStore } } — used for availability lookup in return mode
  // If not provided, falls back to quantities (for readOnly/summary mode).
  stockStats = null,
}) {
  // Step 1: fetch raw category definitions ONCE (they don’t change per-site)
  const [rawCats, setRawCats] = useState([]);
  const [catLoading, setCatLoading] = useState(true);

  useEffect(() => {
    dataAPI.getStockCategories()
      .then(cats => {
        console.log('🔵 CategoryAccordion: fetched', cats.length, 'raw categories from API');
        setRawCats(cats);
      })
      .catch(err => {
        console.error('❌ CategoryAccordion: failed to fetch categories', err);
        setRawCats([]);
      })
      .finally(() => setCatLoading(false));
  }, []); // only fetch category definitions once — they’re global, not per-site

  // Step 2: BUILD the accordion items reactively whenever rawCats OR stockItems changes.
  // CRITICAL: this was previously inside the useEffect above with [] deps, which meant
  // categories were built with stockItems=[] (empty, before stock data loaded from API)
  // and never rebuilt. Now useMemo reacts to stockItems updates correctly.
  const categories = useMemo(() => {
    if (rawCats.length === 0) return [];

    if (stockItems !== null) {
      // Return mode — log what stock data we have for debugging
      const materialNames = stockItems.map(s => s.mat || s.material).filter(Boolean);
      console.log('🟢 CategoryAccordion (return mode): building from', stockItems.length,
        'stock items:', materialNames);

      if (stockStats) {
        const returnable = Object.entries(stockStats)
          .filter(([, s]) => (s.inStore ?? 0) > 0)
          .map(([name, s]) => `${name} (inStore: ${s.inStore})`);
        console.log('🟢 CategoryAccordion: items with inStore > 0:', returnable.length, returnable);
      }
    }

    return buildAccordionCategories(rawCats, stockItems);
  }, [rawCats, stockItems]);

  function toggleCategory(id) {
    setOpenCategory(prev => prev === id ? null : id);
  }

  function updateQty(catId, item, qty) {
    setQuantities(prev => ({ ...prev, [`${catId}__${item}`]: qty }));
  }

  if (catLoading) return <p style={{ color: '#64748b', fontSize: 13 }}>Loading categories…</p>;

  if (categories.length === 0) {
    return (
      <p style={{ color: '#94a3b8', fontSize: 12, padding: '8px 0' }}>
        No stock categories loaded. Check backend connection.
      </p>
    );
  }

  // Normalize helper for case/whitespace-insensitive name matching
  const normalize = (s) => (s || '').toLowerCase().trim();

  return (
    <div>
      {categories.map(cat => {
        const isOpen = openCategory === cat.id;
        // In return mode (stockItems provided), filter to only show items where inStore > 0.
        // Use stockStats for availability (real computed data from live stockData),
        // NOT quantities (which is retQuantities — user-input state, starts as {}).
        const availLookup = stockStats || quantities;
        const itemsToShow = (stockItems !== null)
          ? cat.items.filter(item => {
              const stats = availLookup[item]
                || Object.entries(availLookup).find(([k]) => normalize(k) === normalize(item))?.[1];
              if (!stats) return false;
              const inStore = stats.inStore ?? Math.max(0, (stats.recv ?? 0) - (stats.issued ?? 0) - (stats.ret ?? 0));
              return inStore > 0;
            })
          : cat.items;
        return (
          <div key={cat.id} style={{ border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden', marginBottom: 8 }}>
            {/* Accordion header */}
            <div
              onClick={() => toggleCategory(cat.id)}
              style={{
                background: isOpen ? cat.color : '#f8fafc',
                color: isOpen ? 'white' : '#1e293b',
                padding: '12px 16px', cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontWeight: 600, fontSize: 13,
                transition: 'background 0.2s',
              }}
            >
              <span>{cat.label}</span>
              <span style={{ fontSize: 14 }}>{isOpen ? '▲' : '▼'}</span>
            </div>

            {/* Expanded items */}
            {isOpen && (
              <div style={{ padding: '12px 16px', background: 'white' }}>
                {itemsToShow.length === 0 ? (
                  <div style={{ padding: '10px 0' }}>
                    <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>
                      {stockItems !== null
                        ? '⚠️ No stock available to return in this category yet. Receive stock first.'
                        : 'No default items for this category.'}
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {itemsToShow.map(item => {
                      if (readOnly) {
                        const stats = (stockStats || quantities)[item]
                          || Object.entries(stockStats || quantities).find(([k]) => normalize(k) === normalize(item))?.[1]
                          || {};
                        const recv = stats.recv ?? 0;
                        const issued = stats.issued ?? 0;
                        const ret = stats.ret ?? 0;
                        const inStore = Math.max(0, stats.inStore ?? recv - issued - ret);
                        return (
                          <div key={item} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '10px 12px', fontSize: '12px',
                            borderBottom: '1px solid #f1f5f9',
                            background: '#fafafa', borderRadius: 4,
                          }}>
                            <span style={{ flex: 1, fontSize: 11.5, fontWeight: 500, color: '#374151' }}>{item}</span>
                            <div style={{ display: 'flex', gap: 14, fontSize: '11px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                              <span style={{ color: '#64748b' }}>Received: <b style={{ color: '#2d6a27' }}>{recv}</b></span>
                              <span style={{ color: '#64748b' }}>Used: <b style={{ color: '#1e293b' }}>{issued}</b></span>
                              <span style={{ color: '#64748b' }}>Returned: <b style={{ color: '#3b82f6' }}>{ret}</b></span>
                              <span style={{ color: '#64748b' }}>Available: <b style={{ color: inStore > 0 ? '#16a34a' : '#dc2626' }}>{inStore}</b></span>
                            </div>
                          </div>
                        );
                      }
                      // Edit mode (return stock or receive stock)
                      const val = quantities[`${cat.id}__${item}`] ?? 0;
                      // In return mode, show max available for guidance — use stockStats, not user-input quantities
                      const maxAvail = stockItems !== null ? (() => {
                        const st = stockStats || quantities;
                        const stats = st[item]
                          || Object.entries(st).find(([k]) => normalize(k) === normalize(item))?.[1]
                          || {};
                        return stats.inStore ?? Math.max(0, (stats.recv ?? 0) - (stats.issued ?? 0) - (stats.ret ?? 0));
                      })() : null;
                      return (
                        <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <label style={{ fontSize: 11.5, flex: 1, color: '#374151', lineHeight: 1.3 }}>
                            {item}
                            {maxAvail !== null && <span style={{ fontSize: 10, color: '#64748b', marginLeft: 4 }}>(max: {maxAvail})</span>}
                          </label>
                          <input
                            type="number" min="0" max={maxAvail ?? undefined}
                            value={val === 0 ? '' : val}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const num = raw === '' ? 0 : Number(raw);
                              updateQty(cat.id, item, num);
                            }}
                            onBlur={(e) => { if (e.target.value === '') updateQty(cat.id, item, 0); }}
                            placeholder="0"
                            style={{ width: 70, height: 28, border: '1px solid #d1d5db', borderRadius: 4, padding: '0 6px', fontSize: 12, textAlign: 'right' }}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
export default function Inventory() {
  const { showToast } = useToast();
  const { user } = useContext(AuthContext);
  const { siteList, mergedGAs, getCitiesForGA, getAreasForCity, globalLocationContext, selectedSiteId, siteLoading } = useSite();

  const sites = useMemo(() => siteList.map(s => s.name), [siteList]);

  // ── Item #3: GA Location + City selection (required for Inventory) ──
  const [invGA,   setInvGA]   = useState('');
  const [invCity, setInvCity] = useState('');

  const invGAOptions   = useMemo(() => mergedGAs, [mergedGAs]);
  const invCityOptions = useMemo(() => {
    if (!invGA) return [];
    const ga = mergedGAs.find(g => g.id === invGA);
    return ga ? (ga.cities || []) : [];
  }, [invGA, mergedGAs]);


  // Derive siteId from the GA + City selection.
  const invSiteId = useMemo(() => {
    if (!invGA || !invCity) return null;

    // Priority 1: exact gaName + location match (most reliable).
    // invCity is set to s.location (from assignedPairs or city dropdown which uses s.location as id).
    // invGA is set to s.gaName or a GA id. Try both.
    const exactMatch = siteList.find(s =>
      (s.gaName?.toLowerCase() === invGA.toLowerCase() ||
       s.gaName?.toLowerCase().includes(invGA.toLowerCase()) ||
       invGA.toLowerCase().includes((s.gaName || '').toLowerCase())) &&
      s.location?.toLowerCase() === invCity.toLowerCase()
    );
    if (exactMatch) return exactMatch.id;

    // Priority 2: fuzzy match — GA name + site name contains city label (legacy fallback)
    const cityObj = invCityOptions.find(c => c.id === invCity);
    const cityLabel = (cityObj?.label || cityObj?.name || invCity).toLowerCase();
    const gaObj = mergedGAs.find(g => g.id === invGA);
    const gaLabel = (gaObj?.label || gaObj?.name || invGA).toLowerCase();
    const fuzzyMatch = siteList.find(s => {
      const sName = (s.name || '').toLowerCase();
      const sGA = (s.gaName || '').toLowerCase();
      return (sGA === gaLabel || sGA.includes(gaLabel) || gaLabel.includes(sGA)) &&
             (sName.includes(cityLabel) || cityLabel.includes(sName));
    });
    return fuzzyMatch?.id || selectedSiteId || null;
  }, [invGA, invCity, invCityOptions, mergedGAs, siteList, selectedSiteId]);

  // Keep currentSiteId pointing to the effective siteId for this page
  const currentSiteId = invSiteId;

  const [stockData, setStockData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ── Issue #2: Stock Statement toggle (hidden by default) ──
  const [showStockStatement, setShowStockStatement] = useState(false);

  // ── Issue #4: Challan/DC photo state ──
  const [challanPhotoUrl, setChallanPhotoUrl] = useState('');
  const [challanPhotoUploading, setChallanPhotoUploading] = useState(false);

  // ── Issue #5: Custom column cell values, persisted to localStorage ──
  const [customCellValues, setCustomCellValues] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gppms_inv_custom_cells') || '{}'); }
    catch { return {}; }
  });

  function updateCustomCell(material, colKey, value) {
    setCustomCellValues(prev => {
      const next = { ...prev, [material]: { ...(prev[material] || {}), [colKey]: value } };
      localStorage.setItem('gppms_inv_custom_cells', JSON.stringify(next));
      return next;
    });
  }
  const [panelOpen, setPanelOpen] = useState(false);
  const [exportDate, setExportDate] = useState(todayStr());

  // Stock History modal state
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyDate, setHistoryDate] = useState(todayStr());
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyNote, setHistoryNote] = useState('');

  const isAdmin = (
    user?.role === 'ADMIN' || user?.role === 'admin' ||
    ['oxygenprotech@gmail.com', 'radhe.sangwan1980@gmail.com']
      .includes((user?.email || '').toLowerCase())
  );
  const canWrite = isAdmin || user?.role === 'SUPERVISOR' || user?.role === 'WORKER';

  // ── Assigned pairs (for non-admin locking) ──
  // Each site in siteList IS one GA+City pair (already filtered by backend to user's sites)
  const assignedPairs = useMemo(() => {
    return isAdmin ? [] : siteList.map(s => ({
      siteId:    s.id,
      gaName:    s.gaName   || '',
      cityName:  s.location || '',
      gaLabel:   s.gaName   || s.name || '',
      cityLabel: s.location || '',
      label:     `${s.gaName || ''} — ${s.location || ''}`,
    }));
  }, [isAdmin, siteList]);

  // Auto-set invGA + invCity for non-admins with a single assigned site (via useEffect, not during render)
  useEffect(() => {
    if (isAdmin || siteList.length === 0) return;
    if (assignedPairs.length === 1) {
      setInvGA(assignedPairs[0].gaName);
      setInvCity(assignedPairs[0].cityName);
    }
  }, [isAdmin, assignedPairs.length, siteList.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Delivery form state
  const [challan, setChallan] = useState('');
  const [dateRcv, setDateRcv] = useState(todayStr());
  const [site, setSite] = useState('');
  const [notes, setNotes] = useState('');
  const [formErr, setFormErr] = useState({});

  // Category accordion state
  const [openCategory, setOpenCategory] = useState(null);
  const [quantities, setQuantities] = useState({});

  // 3-level form states for GA Location, City, Area
  const [formGA, setFormGA] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formArea, setFormArea] = useState('');

  // Option lists
  const getAllCities = () => {
    return mergedGAs.flatMap(ga => ga.cities || []);
  };
  const cityOptions = formGA !== '' ? getCitiesForGA(formGA) : getAllCities();
  // For non-admin single-site users, derive area options directly from the assigned site's
  // location field — avoids the one-render gap where formCity is '' before the form open
  // useEffect sets it from assignedPairs[0].cityName.
  const _areaCityId = formCity || (user?.role !== 'ADMIN' && siteList.length === 1 ? (siteList[0]?.location || '') : '');
  const areaOptions = _areaCityId ? getAreasForCity(_areaCityId) : [];

  // Summary accordion & return stock states
  const [openCategoryAccordion, setOpenCategoryAccordion] = useState(null);
  const [returnStockOpen, setReturnStockOpen] = useState(false);

  const summaryQuantities = useMemo(() => {
    // For readOnly accordion: { recv, issued, ret, inStore } per item name
    const q = {};
    (stockData || []).forEach(item => {
      const name = item.mat || item.material;
      const recv = item.recv ?? 0;
      const issued = item.issued ?? 0;
      const ret = item.ret ?? 0;
      q[name] = {
        recv,
        issued,
        ret,
        inStore: Math.max(0, recv - issued - ret),
      };
    });
    return q;
  }, [stockData]);

  const mapStockData = (items) => {
    return (items || []).map((item, idx) => ({
      sr: idx + 1,
      mat: item.material,
      material: item.material,
      unit: item.unit || 'pcs',
      open: 0,
      recv: item.received || 0,
      received: item.received || 0,
      issued: item.issued || 0,
      used: item.issued || 0,
      ret: item.returned || 0,
      returned: item.returned || 0,
      onSite: (item.received || 0) - (item.issued || 0) - (item.returned || 0),
      inStore: item.inStore || 0,
      available: item.inStore || 0,
      req: 0,
      challanPhotoUrl: item.challanPhotoUrl || null,
    }));
  };

  useEffect(() => {
    document.title = 'GP-PMS — Stock Management';
  }, []);

  useEffect(() => {
    async function load() {
      // Item 3: Inventory gated on GA + City selection
      if (!invGA || !invCity) {
        setLoading(false);
        setStockData([]);
        return;
      }
      // Guard: if sites haven't finished loading yet, wait
      if (!invSiteId) {
        if (!siteLoading) {
          setLoading(false);
          setStockData([]);
        }
        return;
      }
      try {
        setLoading(true);
        const items = await stockAPI.getAll(invSiteId);
        setStockData(mapStockData(items));
        setError(null);
      } catch (e) {
        console.error('Failed to load stock:', e);
        setError('Failed to load inventory');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [invSiteId, invGA, invCity, siteLoading]);

  useEffect(() => {
    if (panelOpen) {
      const ctx = globalLocationContext || { gaId: 'all', cityId: 'all', area: 'all' };
      if (ctx.gaId !== 'all') {
        setFormGA(ctx.gaId);
        setFormCity(ctx.cityId !== 'all' ? ctx.cityId : '');
        setFormArea(ctx.area   !== 'all' ? ctx.area   : '');
      } else if (!isAdmin && assignedPairs.length === 1) {
        setFormGA(assignedPairs[0].gaName);
        setFormCity(assignedPairs[0].cityName);
        setFormArea('');
      } else {
        setFormGA(ctx.gaId !== 'all' ? ctx.gaId : '');
        setFormCity(ctx.cityId !== 'all' ? ctx.cityId : '');
        setFormArea(ctx.area !== 'all' ? ctx.area : '');
      }
    }
  }, [panelOpen, globalLocationContext, isAdmin, assignedPairs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (returnStockOpen) {
      const ctx = globalLocationContext || { gaId: 'all', cityId: 'all', area: 'all' };
      if (ctx.gaId !== 'all') {
        setFormGA(ctx.gaId);
        setFormCity(ctx.cityId !== 'all' ? ctx.cityId : '');
        setFormArea(ctx.area   !== 'all' ? ctx.area   : '');
      } else if (!isAdmin && assignedPairs.length === 1) {
        setFormGA(assignedPairs[0].gaName);
        setFormCity(assignedPairs[0].cityName);
        setFormArea('');
      } else {
        setFormGA(ctx.gaId !== 'all' ? ctx.gaId : '');
        setFormCity(ctx.cityId !== 'all' ? ctx.cityId : '');
        setFormArea(ctx.area !== 'all' ? ctx.area : '');
      }
    }
  }, [returnStockOpen, globalLocationContext, isAdmin, assignedPairs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => (stockData || []).map(s => {
    const netUsed = s.issued - s.ret;
    const status = getStatus(s.onSite, s.inStore, s.open, s.recv);
    const onSitePct = (s.open + s.recv) > 0 ? (s.onSite / (s.open + s.recv)) * 100 : 0;
    return { ...s, netUsed, status, onSitePct };
  }), [stockData]);

  const totals = useMemo(() => (rows || []).reduce((acc, r) => ({
    open: acc.open + r.open, recv: acc.recv + r.recv,
    issued: acc.issued + r.issued, ret: acc.ret + r.ret,
    netUsed: acc.netUsed + r.netUsed, onSite: acc.onSite + r.onSite,
    inStore: acc.inStore + r.inStore, req: acc.req + r.req,
  }), { open: 0, recv: 0, issued: 0, ret: 0, netUsed: 0, onSite: 0, inStore: 0, req: 0 }), [rows]);

  // Return Stock Panel form
  const [retDate, setRetDate] = useState(todayStr);
  const [retSite, setRetSite] = useState('');
  const [retRemark, setRetRemark] = useState('');
  const [retQuantities, setRetQuantities] = useState({});
  const [retOpenCategory, setRetOpenCategory] = useState(null);
  const [retFormErr, setRetFormErr] = useState({});

  const remarkWordCount = useMemo(() => {
    return retRemark.trim().split(/\s+/).filter(Boolean).length;
  }, [retRemark]);

  async function handleSaveReturn() {
    const e = {};
    if (!formGA) e.ga = 'GA Location is required';
    if (!formCity) e.city = 'City is required';
    if (!formArea) e.area = 'Area is required';
    if (!retRemark.trim()) e.retRemark = 'Remark/Reason is required';
    if (remarkWordCount > 30) e.retRemark = 'Remark cannot exceed 30 words';
    setRetFormErr(e);
    if (Object.keys(e).length > 0) return;

    // Collect items with qty > 0
    const returnedItems = [];
    Object.entries(retQuantities).forEach(([key, qty]) => {
      if (qty > 0) {
        const [catId, ...itemParts] = key.split('__');
        const name = itemParts.join('__');
        const stockItem = stockData.find(s => s.mat === name || s.material === name);
        const unit = stockItem?.unit || 'pcs';
        returnedItems.push({ name, qty, unit, category: catId });
      }
    });

    if (returnedItems.length === 0) {
      showToast('⚠️ No quantities entered');
      return;
    }

    if (!currentSiteId) {
      showToast('✗ No site selected', 'error');
      return;
    }

    try {
      const itemsToSend = returnedItems.map(item => ({ material: item.name, qty: item.qty }));
      await stockAPI.returnStock(currentSiteId, itemsToSend);
      const refreshed = await stockAPI.getAll(currentSiteId);
      setStockData(mapStockData(refreshed));
      showToast('✓ Stock returned');

      setRetDate(todayStr());
      setRetSite('');
      setRetRemark('');
      setRetQuantities({});
      setRetOpenCategory(null);
      setRetFormErr({});
      setReturnStockOpen(false);
    } catch (err) {
      showToast('✗ Failed to return stock', 'error');
    }
  }

  function openPanel() {
    setQuantities({});
    setOpenCategory(null);
    setChallan(''); setDateRcv(todayStr()); setSite(sites[0] || ''); setNotes(''); setFormErr({});
    setPanelOpen(true);
  }

  async function handleSave() {
    const e = {};
    if (!dateRcv) e.dateRcv = 'Date is required';
    if (!formGA) e.ga = 'GA Location is required';
    if (!formCity) e.city = 'City is required';
    if (!formArea) e.area = 'Area is required';
    setFormErr(e);

    // Scroll & focus to first invalid field
    const fieldOrder = [
      { key: 'dateRcv', id: 'inv-field-date' },
      { key: 'ga', id: 'inv-field-ga' },
      { key: 'city', id: 'inv-field-city' },
      { key: 'area', id: 'inv-field-area' },
    ];
    const first = fieldOrder.find(f => e[f.key]);
    if (first) {
      setTimeout(() => {
        const el = document.getElementById(first.id);
        if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus(); }
      }, 50);
      return;
    }
    if (Object.keys(e).length > 0) return;

    // The quantities keys are: `${catId}__${materialName}`
    // catId is 1-based index matching the sorted DEFAULT_STOCK_CATEGORIES order.
    // Build a lookup: catId (string) → category label
    const SORTED_CATS = Object.keys(DEFAULT_MATERIALS_BY_CATEGORY).sort();
    const catIdToLabel = Object.fromEntries(SORTED_CATS.map((name, i) => [String(i + 1), name]));

    // Collect items with qty > 0
    const receivedItems = [];
    Object.entries(quantities).forEach(([key, qty]) => {
      if (qty > 0) {
        const [catId, ...itemParts] = key.split('__');
        const materialName = itemParts.join('__');
        const categoryLabel = catIdToLabel[catId] || '';
        receivedItems.push({ name: materialName, qty, category: categoryLabel });
      }
    });

    if (receivedItems.length === 0) {
      showToast('⚠️ No quantities entered');
      return;
    }

    if (!currentSiteId) {
      showToast('✗ No site selected', 'error');
      return;
    }

    try {
      // Issue #4: Upload challan photo to R2 first if one was selected
      let uploadedChallanUrl = challanPhotoUrl || null;
      // challanPhotoUrl is already the R2 URL (set by the file input handler)

      const itemsToSend = receivedItems.map(item => ({
        material: item.name,
        qty: item.qty,
        unit: 'pcs',
        category: item.category,
      }));
      await stockAPI.receiveStock(currentSiteId, itemsToSend, uploadedChallanUrl, challan || null, dateRcv || null);
      const refreshed = await stockAPI.getAll(currentSiteId);
      setStockData(mapStockData(refreshed));
      showToast('✓ Stock received');
      setChallanPhotoUrl('');
      setPanelOpen(false);
    } catch (err) {
      showToast('✗ Failed to save', 'error');
    }
  }

  const [customCols, setCustomCols] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('gppms_custom_columns_inventory') || '[]');
    } catch { return []; }
  });

  const [hiddenCols, setHiddenCols] = useState(() => {
    // Migration: wipe stale column-visibility prefs that reference old field names
    const SCHEMA_V = 'v2_2024_schema';
    if (localStorage.getItem('gppms_inv_col_schema') !== SCHEMA_V) {
      localStorage.removeItem('gppms_hidden_cols_inventory');
      localStorage.setItem('gppms_inv_col_schema', SCHEMA_V);
    }
    try { return JSON.parse(localStorage.getItem('gppms_hidden_cols_inventory') || '[]'); } catch { return []; }
  });
  const [showColManager, setShowColManager] = useState(false);
  const [newColNameInv, setNewColNameInv] = useState(''); // controlled input for col manager

  function toggleColVisibility(key) {
    const updated = hiddenCols.includes(key)
      ? hiddenCols.filter(k => k !== key)
      : [...hiddenCols, key];
    setHiddenCols(updated);
    localStorage.setItem('gppms_hidden_cols_inventory', JSON.stringify(updated));
  }


  const handleAddColumn = () => {
    const name = prompt('Enter new column name:');
    if (!name || !name.trim()) return;
    const newCol = {
      key: 'custom_' + Date.now(),
      label: name.trim()
    };
    const updated = [...customCols, newCol];
    setCustomCols(updated);
    localStorage.setItem('gppms_custom_columns_inventory', JSON.stringify(updated));
    showToast(`✓ Column "${name.trim()}" added`);
  };

  const handleRemoveColumn = () => {
    if (customCols.length === 0) { showToast('⚠ No custom columns to remove'); return; }
    const options = customCols.map((c, i) => `${i + 1}. ${c.label}`).join('\n');
    const choice = prompt(`Which column to remove? Enter number:\n${options}`);
    if (!choice) return;
    const idx = parseInt(choice, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= customCols.length) { showToast('⚠ Invalid selection'); return; }
    const removed = customCols[idx];
    const updated = customCols.filter((_, i) => i !== idx);
    setCustomCols(updated);
    localStorage.setItem('gppms_custom_columns_inventory', JSON.stringify(updated));
    showToast(`✓ Column "${removed.label}" removed`);
  };

  const handleDeleteItem = async (materialName) => {
    const confirmed = window.confirm(
      `Delete "${materialName}" from inventory?\n\nThis will permanently remove this item and all its stock history (Received / Used / Returned / Available data).`
    );
    if (!confirmed) return;

    if (!currentSiteId) {
      showToast('✗ No site selected', 'error');
      return;
    }

    try {
      await stockAPI.deleteItem(currentSiteId, materialName);
      const refreshed = await stockAPI.getAll(currentSiteId);
      setStockData(mapStockData(refreshed));
      showToast('✓ Item deleted');
    } catch (err) {
      showToast('✗ Failed to delete', 'error');
    }
  };

  const handleEditCell = (itemSr, colKey, colLabel, currentVal) => {
    if (!canWrite) return;
    const newVal = prompt(`Enter ${colLabel} for this item:`, currentVal || '');
    if (newVal === null) return;
    // Update local display state only (custom column data is UI-side)
    setStockData(prev => prev.map(s => s.sr === itemSr ? { ...s, [colKey]: newVal.trim() } : s));
    showToast('✓ Value updated');
  };

  function onSiteColor(r) {
    if (r.onSitePct < 20) return '#dc2626';
    if (r.onSitePct < 40) return '#d97706';
    return '#1e293b';
  }

  return (
    <div>
      {/* ── Item 3: GA Location + City selector (required for Inventory) ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap',
          background: 'linear-gradient(135deg, #f0f7ee 0%, #e8f5e2 100%)',
          border: '1px solid #c6e0c0', borderRadius: 8, padding: '10px 14px' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#2d6a27', whiteSpace: 'nowrap' }}>📍 View Stock For:</span>
        {/* GA Location — paired locking for non-admins */}
        {!isAdmin && assignedPairs.length === 1 ? (
          <span style={{ fontSize: 12, fontWeight: 600, color: '#1f4e1a', background: '#e8f5e2', border: '1px solid #a7c4a3', borderRadius: 4, padding: '4px 10px' }}>
            {assignedPairs[0].gaLabel}
          </span>
        ) : !isAdmin && assignedPairs.length > 1 ? (
          // Multiple assigned pairs — ONE combined dropdown
          <select
            id="inv-ga-filter"
            value={assignedPairs.find(p => p.gaName === invGA && p.cityName === invCity)?.siteId || ''}
            onChange={e => {
              const pair = assignedPairs.find(p => p.siteId === e.target.value);
              if (pair) { setInvGA(pair.gaName); setInvCity(pair.cityName); }
            }}
            style={{ height: 32, border: '1px solid #a7c4a3', borderRadius: 4, padding: '0 8px',
                fontSize: 12, background: '#fff', color: '#1f4e1a', cursor: 'pointer' }}
          >
            <option value="">— Select GA — City —</option>
            {assignedPairs.map(p => <option key={p.siteId} value={p.siteId}>{p.label}</option>)}
          </select>
        ) : (
          // Admin: full open GA dropdown
          <select
            id="inv-ga-filter"
            value={invGA}
            onChange={e => { setInvGA(e.target.value); setInvCity(''); }}
            style={{ height: 32, border: '1px solid #a7c4a3', borderRadius: 4, padding: '0 8px',
                fontSize: 12, background: '#fff', color: '#1f4e1a', cursor: 'pointer' }}
          >
            <option value="">— Select GA Location —</option>
            {invGAOptions.map(g => <option key={g.id} value={g.id}>{g.label || g.name}</option>)}
          </select>
        )}
        {/* City — locked for single pair, read-only for multi-pair, open for admin */}
        {!isAdmin && assignedPairs.length === 1 ? (
          <span style={{ fontSize: 12, fontWeight: 600, color: '#1f4e1a', background: '#e8f5e2', border: '1px solid #a7c4a3', borderRadius: 4, padding: '4px 10px' }}>
            {assignedPairs[0].cityLabel}
          </span>
        ) : !isAdmin && assignedPairs.length > 1 ? (
          // City shown as read-only label (set by combined GA—City dropdown above)
          <span style={{ fontSize: 12, fontWeight: 600, color: invCity ? '#1f4e1a' : '#94a3b8', background: '#e8f5e2', border: '1px solid #a7c4a3', borderRadius: 4, padding: '4px 10px', fontStyle: invCity ? 'normal' : 'italic' }}>
            {invCity || 'Select above ↑'}
          </span>
        ) : (
          // Admin: full open city dropdown
          <select
            id="inv-city-filter"
            value={invCity}
            onChange={e => setInvCity(e.target.value)}
            disabled={!invGA}
            style={{ height: 32, border: '1px solid #a7c4a3', borderRadius: 4, padding: '0 8px',
                fontSize: 12, background: invGA ? '#fff' : '#f8faf7', color: '#1f4e1a',
                cursor: invGA ? 'pointer' : 'not-allowed', opacity: invGA ? 1 : 0.6 }}
          >
            <option value="">— Select City —</option>
            {invCityOptions.map(c => <option key={c.id} value={c.id}>{c.label || c.name}</option>)}
          </select>
        )}
        {invGA && invCity && (
          <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>
            ✔ Viewing: {invCityOptions.find(c => c.id === invCity)?.label || invCity}
          </span>
        )}
        {(!invGA || !invCity) && (
          <span style={{ fontSize: 11, color: '#d97706', fontStyle: 'italic' }}>
            Select GA Location and City to view inventory
          </span>
        )}
      </div>

      {/* ── Main header row ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1f4e1a', margin: 0 }}>Stock Statement</h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '2px 0 0' }}>{rows.length} materials tracked</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>Export as of</span>
          <input type="date" value={exportDate} onChange={e => setExportDate(e.target.value)}
            style={{ height: 32, border: '1px solid #d1d5db', borderRadius: 4, padding: '0 8px', fontSize: 12 }} />
          <button onClick={() => exportStockData(rows, exportDate)} className="btn btn-outline" style={{ height: 32 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            Export
          </button>
          <button
            onClick={async () => {
              if (!currentSiteId) { showToast('✗ No site selected', 'error'); return; }
              setHistoryLoading(true);
              setShowHistoryModal(true);
              try {
                const receipts = await stockAPI.getReceipts(currentSiteId);
                setHistoryData(receipts);
                setHistoryNote('');
              } catch (err) {
                showToast('✗ Failed to load receipt history', 'error');
                setShowHistoryModal(false);
              } finally {
                setHistoryLoading(false);
              }
            }}
            style={{ height: 32, background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 4, padding: '0 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            📦 Stock History
          </button>
          {canWrite && (
            <>
              <button onClick={handleAddColumn} className="btn btn-primary" style={{ height: 32, fontSize: 12 }}>
                ➕ Add Column
              </button>
              {customCols.length > 0 && (
                <button
                  onClick={handleRemoveColumn}
                  style={{
                    height: 32, background: '#fee2e2', color: '#dc2626',
                    border: '1px solid #fca5a5', borderRadius: 4,
                    padding: '0 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  ✕ Remove Column
                </button>
              )}
              <button onClick={() => setShowColManager(true)}
                style={{ height: 32, background: '#2d6a27', color: '#fff', border: 'none', borderRadius: 4, padding: '0 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                ⚙ Manage Columns
              </button>
              <button onClick={() => setReturnStockOpen(true)}
                style={{
                  padding: '0 16px',
                  height: '38px',
                  background: 'white',
                  border: '1px solid #c0440a',
                  color: '#c0440a',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                ↩ Return Stock
              </button>
              <button onClick={openPanel} className="btn btn-primary" style={{ height: 32 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Receive Stock
              </button>
            </>
          )}
        </div>
      </div>

      {loading && (
        <div style={{ padding: 24, textAlign: 'center', color: '#64748b', fontSize: 14 }}>
          Loading inventory...
        </div>
      )}
      {error && (
        <div style={{ padding: 16, margin: '12px 0', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, color: '#dc2626', fontSize: 13, fontWeight: 600 }}>
          Error: {error}
        </div>
      )}

      {/* ── Item 3: Gate — show prompt if no GA+City selected ── */}
      {(!invGA || !invCity) && (
        <div style={{ textAlign: 'center', padding: '48px 24px', background: 'linear-gradient(135deg, #f0f7ee 0%, #e8f5e2 100%)',
            borderRadius: 12, border: '1px dashed #c6e0c0', marginBottom: 16 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📍</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1f4e1a', margin: '0 0 8px' }}>
            Select a GA Location and City to view stock
          </h2>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
            Use the selectors above to filter inventory by location.
          </p>
        </div>
      )}

      {!loading && !error && invGA && invCity && (
        <>
          <div style={{ marginBottom: 16 }}>
            <h3 style={{
              fontSize: 14, fontWeight: 600,
              color: '#1f4e1a', marginBottom: 10
            }}>
              Stock by Category
              {stockData.length === 0 && (
                <span style={{ fontSize: 12, fontWeight: 400, color: '#94a3b8', marginLeft: 8 }}>
                  — No stock received yet. Use "Receive Stock" to add items.
                </span>
              )}
            </h3>
            <CategoryAccordion
              openCategory={openCategoryAccordion}
              setOpenCategory={setOpenCategoryAccordion}
              quantities={summaryQuantities}
              setQuantities={() => { }}
              readOnly={true}
            />
          </div>

          {/* ── Issue #2: Stock Statement toggle ── */}
          {rows.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <button
                onClick={() => setShowStockStatement(s => !s)}
                style={{
                  height: 32, background: showStockStatement ? '#1f4e1a' : '#f0f7ee',
                  color: showStockStatement ? '#fff' : '#2d6a27',
                  border: '1px solid #2d6a27', borderRadius: 4,
                  padding: '0 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                📊 {showStockStatement ? 'Hide Stock Statement' : 'Show Stock Statement'}
                <span style={{ fontSize: 10 }}>{showStockStatement ? '▲' : '▼'}</span>
              </button>
            </div>
          )}

          {/* ── Stock Statement Table ── */}
          {showStockStatement && rows.length > 0 && (() => {
            // Status helper
            const getStockStatus = (available, received) => {
              if (received === 0) return { label: 'No Data', color: '#94a3b8', bg: '#f1f5f9' };
              const pct = (available / received) * 100;
              if (pct >= 50) return { label: 'Good', color: '#16a34a', bg: '#dcfce7' };
              if (pct >= 20) return { label: 'Low', color: '#d97706', bg: '#fef3c7' };
              return { label: 'Critical', color: '#dc2626', bg: '#fee2e2' };
            };

            return (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1f4e1a', marginBottom: 10, letterSpacing: '-0.01em' }}>
                  Stock Statement
                </h3>

                {/* Table card */}
                <div style={{
                  background: '#fff',
                  borderRadius: 10,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
                  overflow: 'hidden',
                }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{
                          background: 'linear-gradient(135deg, #2d6a27 0%, #1f4e1a 100%)',
                          color: '#fff',
                        }}>
                          {[
                            { label: 'Sr.', align: 'center', style: { width: 48 } },
                            { label: 'Material', align: 'left', style: { minWidth: 190 } },
                            { label: 'Unit', align: 'center', style: { width: 64 } },
                            { label: 'Received', align: 'right' },
                            { label: 'Used', align: 'right' },
                            { label: 'Returned', align: 'right' },
                            { label: 'Available', align: 'right' },
                            { label: 'Status', align: 'center' },
                            ...(canWrite ? [{ label: 'Action', align: 'center', style: { width: 80 } }] : []),
                          ].map(col => (
                            <th key={col.label} style={{
                              padding: '14px 16px',
                              textAlign: col.align,
                              fontWeight: 700,
                              fontSize: 11,
                              letterSpacing: '0.05em',
                              textTransform: 'uppercase',
                              whiteSpace: 'nowrap',
                              ...col.style,
                            }}>{col.label}</th>
                          ))}
                          {/* ── Issue #5: Custom column headers ── */}
                          {customCols.filter(c => !hiddenCols.includes(c.key)).map(c => (
                            <th key={c.key} style={{
                              padding: '14px 16px', textAlign: 'center',
                              fontWeight: 700, fontSize: 11, letterSpacing: '0.05em',
                              textTransform: 'uppercase', whiteSpace: 'nowrap',
                              background: 'rgba(255,255,255,0.15)',
                            }}>{c.label}</th>
                          ))}
                        </tr>
                      </thead>

                      <tbody>
                        {rows.map((r, i) => {
                          const recv = r.recv || 0;
                          const used = r.issued || 0;
                          const returned = r.ret || 0;
                          const available = Math.max(0, recv - used - returned);
                          const status = getStockStatus(available, recv);
                          const base = i % 2 === 0 ? '#fff' : '#f8fbf8';

                          return (
                            <tr
                              key={r.sr}
                              style={{ background: base, borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}
                              onMouseEnter={e => e.currentTarget.style.background = '#f0f7ee'}
                              onMouseLeave={e => e.currentTarget.style.background = base}
                            >
                              {/* Sr. */}
                              <td style={{ padding: '14px 16px', textAlign: 'center', color: '#94a3b8', fontWeight: 500 }}>
                                {r.sr}
                              </td>

                              {/* Material */}
                              <td style={{ padding: '14px 16px', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }}>
                                {r.mat}
                                {/* Item 2: Challan photo — PhotoViewer (preview + download) */}
                                {r.challanPhotoUrl && (
                                  <span style={{ marginLeft: 6, display: 'inline-flex', verticalAlign: 'middle' }}>
                                    <PhotoViewer photoUrl={r.challanPhotoUrl} label="DC / Challan Photo" />
                                  </span>
                                )}
                              </td>

                              {/* Unit */}
                              <td style={{ padding: '14px 16px', textAlign: 'center', color: '#64748b', fontSize: 12 }}>
                                {r.unit}
                              </td>

                              {/* Received */}
                              <td style={{ padding: '14px 16px', textAlign: 'right', color: '#2d6a27', fontWeight: 600 }}>
                                {recv.toLocaleString()}
                              </td>

                              {/* Used */}
                              <td style={{ padding: '14px 16px', textAlign: 'right', color: '#1e293b', fontWeight: 600 }}>
                                {used.toLocaleString()}
                              </td>

                              {/* Returned */}
                              <td style={{ padding: '14px 16px', textAlign: 'right', color: '#3b82f6', fontWeight: 600 }}>
                                {returned.toLocaleString()}
                              </td>

                              {/* Available */}
                              <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                <span style={{
                                  fontWeight: 700,
                                  fontSize: 14,
                                  color: available > 0 ? '#16a34a' : '#dc2626',
                                }}>
                                  {available.toLocaleString()}
                                </span>
                              </td>

                              {/* Status badge */}
                              <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                <span style={{
                                  background: status.bg,
                                  color: status.color,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  padding: '4px 10px',
                                  borderRadius: 12,
                                  display: 'inline-block',
                                  whiteSpace: 'nowrap',
                                }}>
                                  {status.label}
                                </span>
                              </td>

                              {/* Delete action */}
                              {canWrite && (
                                <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                  <button
                                    onClick={() => handleDeleteItem(r.mat)}
                                    title={`Delete "${r.mat}" from inventory`}
                                    style={{
                                      background: 'white',
                                      border: '1px solid #dc2626',
                                      color: '#dc2626',
                                      padding: '4px 8px',
                                      borderRadius: 4,
                                      fontSize: 11,
                                      cursor: 'pointer',
                                      fontWeight: 600,
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    🗑 Delete
                                  </button>
                                </td>
                              )}

                              {/* ── Issue #5: Custom column editable cells ── */}
                              {customCols.filter(c => !hiddenCols.includes(c.key)).map(c => {
                                const cellVal = (customCellValues[r.mat] || {})[c.key] || '';
                                return (
                                  <td
                                    key={c.key}
                                    style={{ padding: '8px 12px', textAlign: 'center', minWidth: 100 }}
                                  >
                                    <input
                                      type="text"
                                      value={cellVal}
                                      placeholder="—"
                                      onChange={e => updateCustomCell(r.mat, c.key, e.target.value)}
                                      style={{
                                        width: '100%', border: '1px solid #e2e8f0',
                                        borderRadius: 4, padding: '4px 6px',
                                        fontSize: 12, textAlign: 'center',
                                        background: '#fafafa', outline: 'none',
                                      }}
                                      onFocus={e => e.target.style.borderColor = '#2d6a27'}
                                      onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>

                      <tfoot>
                        <tr style={{ background: '#f0f7ee', borderTop: '2px solid #2d6a27' }}>
                          <td colSpan={3} style={{ padding: '16px', textAlign: 'right', color: '#1f4e1a', fontWeight: 700, fontSize: 12, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                            Total
                          </td>
                          <td style={{ padding: '16px', textAlign: 'right', color: '#2d6a27', fontWeight: 700 }}>
                            {rows.reduce((s, r) => s + (r.recv || 0), 0).toLocaleString()}
                          </td>
                          <td style={{ padding: '16px', textAlign: 'right', color: '#1e293b', fontWeight: 700 }}>
                            {rows.reduce((s, r) => s + (r.issued || 0), 0).toLocaleString()}
                          </td>
                          <td style={{ padding: '16px', textAlign: 'right', color: '#3b82f6', fontWeight: 700 }}>
                            {rows.reduce((s, r) => s + (r.ret || 0), 0).toLocaleString()}
                          </td>
                          <td style={{ padding: '16px', textAlign: 'right', color: '#16a34a', fontWeight: 700, fontSize: 14 }}>
                            {rows.reduce((s, r) => s + Math.max(0, (r.recv || 0) - (r.issued || 0) - (r.ret || 0)), 0).toLocaleString()}
                          </td>
                          <td />
                          {canWrite && <td />}
                          {/* Empty cells for custom cols in footer */}
                          {customCols.filter(c => !hiddenCols.includes(c.key)).map(c => <td key={c.key} />)}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Status legend */}
                <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 11, color: '#64748b', flexWrap: 'wrap' }}>
                  <span>🟢 Good — 50%+ available</span>
                  <span>🟡 Low — 20–49% available</span>
                  <span>🔴 Critical — under 20% available</span>
                </div>
              </div>
            );
          })()}
        </>
      )}


      <p style={{ marginTop: 10, fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
        ℹ️ Materials used per house entry are automatically deducted from Used Qty.
      </p>

      {/* Receive Stock Panel */}
      <SlidePanel isOpen={panelOpen} onClose={() => setPanelOpen(false)} title="Receive New Stock" onSave={handleSave}>
        <div>
          <SectionTitle>Delivery Details</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Challan / DC Number (optional)">
              <Input value={challan} onChange={val => setChallan(val)} placeholder="e.g. DC-2026-001" />
            </Field>

            {/* ── Issue #4: Challan / DC photo upload ── */}
            <Field label="Challan / DC Photo (optional)">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <label
                  htmlFor="challan-photo-input"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    height: 32, padding: '0 12px', background: '#f0f7ee',
                    border: '1px solid #a7c4a3', borderRadius: 4,
                    fontSize: 12, fontWeight: 600, color: '#2d6a27', cursor: 'pointer',
                  }}
                >
                  {challanPhotoUploading ? '⏳ Uploading...' : '📷 Attach Photo'}
                </label>
                <input
                  id="challan-photo-input"
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  disabled={challanPhotoUploading}
                  onChange={async e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = async () => {
                      try {
                        setChallanPhotoUploading(true);
                        const url = await uploadAPI.uploadPhoto(reader.result, 'challan_' + challan);
                        setChallanPhotoUrl(url);
                      } catch (err) {
                        console.error('❌ Challan photo upload failed:', err);
                        showToast('✗ Photo upload failed — check R2 config', 'error');
                      } finally {
                        setChallanPhotoUploading(false);
                      }
                    };
                    reader.readAsDataURL(file);
                  }}
                />
                {challanPhotoUrl && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <img
                      src={challanPhotoUrl}
                      alt="Challan"
                      style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, border: '1px solid #e2e8f0' }}
                    />
                    <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>✔ Uploaded</span>
                    <button
                      onClick={() => setChallanPhotoUrl('')}
                      style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 12 }}
                    >✕</button>
                  </div>
                )}
              </div>
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
              <Field label="Date Received" required error={formErr.dateRcv}>
                <Input id="inv-field-date" type="date" value={dateRcv} onChange={val => setDateRcv(val)} error={formErr.dateRcv} />
              </Field>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
              <Field label="GA Location" required error={formErr.ga}>
                {!isAdmin && assignedPairs.length === 1 ? (
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1f4e1a', padding: '8px 10px', background: '#f0f7ee', border: '1px solid #c6e0c0', borderRadius: 5 }}>
                    {assignedPairs[0].gaLabel}
                  </div>
                ) : !isAdmin && assignedPairs.length > 1 ? (
                  <Select
                    id="inv-field-ga"
                    value={assignedPairs.find(p => p.gaName === formGA && p.cityName === formCity)?.siteId || ''}
                    onChange={val => {
                      const pair = assignedPairs.find(p => p.siteId === val);
                      if (pair) { setFormGA(pair.gaName); setFormCity(pair.cityName); setFormArea(''); }
                    }}
                    error={formErr.ga}
                  >
                    <option value="">Select GA — City</option>
                    {assignedPairs.map(p => <option key={p.siteId} value={p.siteId}>{p.label}</option>)}
                  </Select>
                ) : (
                  <Select
                    id="inv-field-ga"
                    value={formGA}
                    onChange={val => {
                      setFormGA(val);
                      setFormCity('');
                      setFormArea('');
                    }}
                    error={formErr.ga}
                  >
                    <option value="">Select GA Location</option>
                    {mergedGAs.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                  </Select>
                )}
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="City" required error={formErr.city}>
                  {!isAdmin && assignedPairs.length === 1 ? (
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1f4e1a', padding: '8px 10px', background: '#f0f7ee', border: '1px solid #c6e0c0', borderRadius: 5 }}>
                      {assignedPairs[0].cityLabel}
                    </div>
                  ) : !isAdmin && assignedPairs.length > 1 ? (
                    <div style={{ fontSize: 13, fontWeight: 600, color: formCity ? '#1f4e1a' : '#94a3b8', padding: '8px 10px', background: '#f8faf7', border: '1px solid #c6e0c0', borderRadius: 5, fontStyle: formCity ? 'normal' : 'italic' }}>
                      {formCity || 'Select above ↑'}
                    </div>
                  ) : (
                    <Select
                      id="inv-field-city"
                      value={formCity}
                      onChange={val => {
                        setFormCity(val);
                        setFormArea('');
                      }}
                      error={formErr.city}
                    >
                      <option value="">Select City</option>
                      {cityOptions.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </Select>
                  )}
                </Field>
                <Field label="Area / Site" required error={formErr.area}>
                  <Select
                    id="inv-field-area"
                    value={formArea}
                    onChange={val => {
                      console.log('🔵 [Inventory Rcv] Area onChange fired, new value:', val);
                      setFormArea(val);
                    }}
                    error={formErr.area}
                  >
                    <option value="">Select Area</option>
                    {areaOptions.map(a => <option key={a} value={a}>{a}</option>)}
                  </Select>
                </Field>
              </div>
            </div>
          </div>
        </div>
        <div>
          <SectionTitle>Materials Received</SectionTitle>
          <p style={{ fontSize: 11, color: '#64748b', marginBottom: 10 }}>
            Click a category to expand. Enter quantities received (leave 0 to skip).
          </p>
          <CategoryAccordion
            openCategory={openCategory}
            setOpenCategory={setOpenCategory}
            quantities={quantities}
            setQuantities={setQuantities}
          />
        </div>
        <div>
          <SectionTitle>Notes / Remarks</SectionTitle>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Optional notes about this delivery..." rows={3}
            style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 5, padding: '8px 10px', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
        </div>
      </SlidePanel>

      {/* Return Stock Slide Panel */}
      <SlidePanel
        isOpen={returnStockOpen}
        onClose={() => { setReturnStockOpen(false); setRetFormErr({}); }}
        title="Return Stock"
        onSave={handleSaveReturn}
        saveDisabled={remarkWordCount > 30}
      >
        <div>
          <SectionTitle>Return Details</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
              <Field label="Return Date" required error={retFormErr.retDate}>
                <Input type="date" value={retDate} onChange={val => setRetDate(val)} error={retFormErr.retDate} />
              </Field>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
              <Field label="GA Location" required error={retFormErr.ga}>
                {!isAdmin && assignedPairs.length === 1 ? (
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1f4e1a', padding: '8px 10px', background: '#f0f7ee', border: '1px solid #c6e0c0', borderRadius: 5 }}>
                    {assignedPairs[0].gaLabel}
                  </div>
                ) : !isAdmin && assignedPairs.length > 1 ? (
                  <Select
                    value={assignedPairs.find(p => p.gaName === formGA && p.cityName === formCity)?.siteId || ''}
                    onChange={val => {
                      const pair = assignedPairs.find(p => p.siteId === val);
                      if (pair) { setFormGA(pair.gaName); setFormCity(pair.cityName); setFormArea(''); }
                    }}
                    error={retFormErr.ga}
                  >
                    <option value="">Select GA — City</option>
                    {assignedPairs.map(p => <option key={p.siteId} value={p.siteId}>{p.label}</option>)}
                  </Select>
                ) : (
                  <Select
                    value={formGA}
                    onChange={val => {
                      setFormGA(val);
                      setFormCity('');
                      setFormArea('');
                    }}
                    error={retFormErr.ga}
                  >
                    <option value="">Select GA Location</option>
                    {mergedGAs.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                  </Select>
                )}
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="City" required error={retFormErr.city}>
                  {!isAdmin && assignedPairs.length === 1 ? (
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1f4e1a', padding: '8px 10px', background: '#f0f7ee', border: '1px solid #c6e0c0', borderRadius: 5 }}>
                      {assignedPairs[0].cityLabel}
                    </div>
                  ) : !isAdmin && assignedPairs.length > 1 ? (
                    <div style={{ fontSize: 13, fontWeight: 600, color: formCity ? '#1f4e1a' : '#94a3b8', padding: '8px 10px', background: '#f8faf7', border: '1px solid #c6e0c0', borderRadius: 5, fontStyle: formCity ? 'normal' : 'italic' }}>
                      {formCity || 'Select above ↑'}
                    </div>
                  ) : (
                    <Select
                      value={formCity}
                      onChange={val => {
                        setFormCity(val);
                        setFormArea('');
                      }}
                      error={retFormErr.city}
                    >
                      <option value="">Select City</option>
                      {cityOptions.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </Select>
                  )}
                </Field>
                <Field label="Area / Site" required error={retFormErr.area}>
                  <Select
                    value={formArea}
                    onChange={val => {
                      console.log('🔵 [Inventory Ret] Area onChange fired, new value:', val);
                      setFormArea(val);
                    }}
                    error={retFormErr.area}
                  >
                    <option value="">Select Area</option>
                    {areaOptions.map(a => <option key={a} value={a}>{a}</option>)}
                  </Select>
                </Field>
              </div>
            </div>
          </div>
        </div>

        <div>
          <SectionTitle>Materials Returned</SectionTitle>
          <p style={{ fontSize: 11, color: '#64748b', marginBottom: 10 }}>
            Click a category to expand. Enter quantities returned (leave 0 to skip).
          </p>
          <CategoryAccordion
            openCategory={retOpenCategory}
            setOpenCategory={setRetOpenCategory}
            quantities={retQuantities}
            setQuantities={setRetQuantities}
            stockItems={stockData}
            stockStats={summaryQuantities}
          />
        </div>

        <div>
          <SectionTitle>Reason / Remark</SectionTitle>
          <textarea
            value={retRemark}
            onChange={e => setRetRemark(e.target.value)}
            placeholder="Enter reason or remark..."
            rows={3}
            style={{
              width: '100%',
              border: retFormErr.retRemark ? '1px solid #dc2626' : '1px solid #d1d5db',
              borderRadius: 5,
              padding: '8px 10px',
              fontSize: 13,
              resize: 'vertical',
              boxSizing: 'border-box'
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontSize: 11, color: retFormErr.retRemark ? '#dc2626' : '#64748b' }}>
              {retFormErr.retRemark || 'Word limit: max 30 words'}
            </span>
            <span style={{ fontSize: 11, fontWeight: '600', color: remarkWordCount > 30 ? '#dc2626' : '#64748b' }}>
              {remarkWordCount} / 30 words
            </span>
          </div>
        </div>
      </SlidePanel>

      {/* ── Column Manager Modal ── */}
      {showColManager && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContext: 'center', padding: 20 }}
          onClick={() => setShowColManager(false)}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, maxWidth: 420, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', maxHeight: '85vh', overflowY: 'auto', margin: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContext: 'space-between', marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1f4e1a' }}>⚙ Manage Columns</h3>
              <button onClick={() => setShowColManager(false)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b', lineHeight: 1 }}>×</button>
            </div>
            <p style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>Toggle columns on/off. Hidden columns are saved for your session.</p>

            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Built-in Columns</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              {DEFAULT_COLS.map(col => (
                <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 6, background: hiddenCols.includes(col.key) ? '#f8fafc' : '#f0f7ee', cursor: 'pointer', border: '1px solid', borderColor: hiddenCols.includes(col.key) ? '#e2e8f0' : '#bbf7d0' }}>
                  <input type="checkbox" checked={!hiddenCols.includes(col.key)}
                    onChange={() => toggleColVisibility(col.key)}
                    style={{ accentColor: '#2d6a27', width: 15, height: 15 }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: hiddenCols.includes(col.key) ? '#94a3b8' : '#1f4e1a', flex: 1 }}>{col.label}</span>
                  {hiddenCols.includes(col.key) && <span style={{ fontSize: 10, color: '#94a3b8', background: '#f1f5f9', padding: '1px 6px', borderRadius: 4 }}>hidden</span>}
                </label>
              ))}
            </div>

            {customCols.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Custom Columns</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                  {customCols.map(col => (
                    <div key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 6, background: hiddenCols.includes(col.key) ? '#f8fafc' : '#fefce8', border: '1px solid', borderColor: hiddenCols.includes(col.key) ? '#e2e8f0' : '#fde68a' }}>
                      <input type="checkbox" checked={!hiddenCols.includes(col.key)}
                        onChange={() => toggleColVisibility(col.key)}
                        style={{ accentColor: '#2d6a27', width: 15, height: 15 }} />
                      <span style={{ fontSize: 13, fontWeight: 500, color: hiddenCols.includes(col.key) ? '#94a3b8' : '#92400e', flex: 1 }}>{col.label}</span>
                      <button onClick={() => {
                        const updated = customCols.filter(c => c.key !== col.key);
                        setCustomCols(updated);
                        localStorage.setItem('gppms_custom_columns_inventory', JSON.stringify(updated));
                        setHiddenCols(prev => prev.filter(k => k !== col.key));
                        showToast(`Column "${col.label}" deleted`);
                      }} title="Delete this column permanently"
                        style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 4, width: 26, height: 26, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContext: 'center', flexShrink: 0 }}>×</button>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Add New Column</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  placeholder="Column name..."
                  value={newColNameInv}
                  onChange={e => setNewColNameInv(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') e.currentTarget.nextElementSibling?.click();
                  }}
                  style={{ flex: 1, height: 34, border: '1px solid #d1d5db', borderRadius: 6, padding: '0 10px', fontSize: 13 }} />
                <button onClick={() => {
                  const val = newColNameInv.trim();
                  if (!val) return;
                  const newCol = { key: 'custom_' + Date.now(), label: val };
                  const updated = [...customCols, newCol];
                  setCustomCols(updated);
                  localStorage.setItem('gppms_custom_columns_inventory', JSON.stringify(updated));
                  setNewColNameInv('');
                  showToast(`✓ Column "${val}" added`);
                }} style={{ height: 34, background: '#2d6a27', color: '#fff', border: 'none', borderRadius: 6, padding: '0 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Add</button>
              </div>
            </div>

            <button onClick={() => { setHiddenCols([]); localStorage.removeItem('gppms_hidden_cols_inventory'); showToast('All columns visible'); }}
              style={{ marginTop: 14, width: '100%', height: 32, background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              ↺ Reset — Show All Columns
            </button>
          </div>
        </div>
      )}
      {/* ── Stock History Modal — shows StockReceipt transaction log ── */}
      {showHistoryModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setShowHistoryModal(false); }}
        >
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 860, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ background: '#1e3a5f', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <span style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>📦 Stock Receive History</span>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginLeft: 10 }}>Chronological log of all received stock</span>
              </div>
              <button onClick={() => setShowHistoryModal(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            {/* Count badge */}
            <div style={{ padding: '10px 20px', borderBottom: '1px solid #e2e8f0', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>
                {historyData.length} receipt event{historyData.length !== 1 ? 's' : ''} found
              </span>
            </div>

            {/* Table body */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '0 0 16px' }}>
              {historyLoading ? (
                <div style={{ padding: 32, textAlign: 'center', color: '#64748b', fontSize: 13 }}>Loading receipt history...</div>
              ) : historyData.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                  No stock receipts found for this site yet.<br />
                  <span style={{ fontSize: 11, color: '#c0c0c0' }}>Receipts will appear here after you use "Receive Stock" from today.</span>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2540 100%)', color: '#fff', position: 'sticky', top: 0 }}>
                      {['Date', 'Challan / DC No.', 'Material', 'Qty Received', 'Photo'].map(h => (
                        <th key={h} style={{ padding: '12px 14px', textAlign: h === 'Material' || h === 'Challan / DC No.' ? 'left' : 'center', fontWeight: 700, fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.map((r, i) => {
                      const base = i % 2 === 0 ? '#fff' : '#f8fbf8';
                      // Format date as DD/MM/YYYY
                      const d = r.receivedAt ? new Date(r.receivedAt) : null;
                      const dateStr = d
                        ? `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
                        : '—';
                      return (
                        <tr key={r.id} style={{ background: base, borderBottom: '1px solid #f1f5f9' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                          onMouseLeave={e => e.currentTarget.style.background = base}>
                          <td style={{ padding: '11px 14px', textAlign: 'center', color: '#374151', fontWeight: 500, whiteSpace: 'nowrap' }}>{dateStr}</td>
                          <td style={{ padding: '11px 14px', color: '#64748b', fontStyle: r.challanNo ? 'normal' : 'italic' }}>
                            {r.challanNo || <span style={{ color: '#c0c0c0' }}>—</span>}
                          </td>
                          <td style={{ padding: '11px 14px', fontWeight: 600, color: '#1e293b' }}>{r.material}</td>
                          <td style={{ padding: '11px 14px', textAlign: 'center', color: '#2d6a27', fontWeight: 700, fontSize: 13 }}>
                            {r.quantity.toLocaleString()} <span style={{ fontWeight: 400, fontSize: 10, color: '#64748b' }}>{r.unit}</span>
                          </td>
                          <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                            {r.photoUrl ? (
                              <PhotoViewer photoUrl={r.photoUrl} label="Challan Photo" />
                            ) : (
                              <span style={{ fontSize: 11, color: '#c0c0c0', fontStyle: 'italic' }}>No photo</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
