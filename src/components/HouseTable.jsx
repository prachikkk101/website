// src/components/HouseTable.jsx
import { useState, useMemo, useEffect, useContext } from 'react';
import MeterModal from './MeterModal';
import { exportHouseData } from '../utils/exportExcel';
import SlidePanel, { Field, Input, Select, SectionTitle } from './SlidePanel';
import { useToast } from './Toast';
import { AuthContext } from '../context/AuthContext';
import { useSite, useSiteAreas } from '../context/SiteContext';
import { pngAPI, dataAPI, columnConfigAPI, uploadAPI } from '../utils/api';
import { buildAccordionCategories } from '../utils/stockCategories';
import PhotoViewer from './PhotoViewer';


/* ── Helpers ── */
function getSession() {
  try { return JSON.parse(localStorage.getItem('gppms_session') || '{}'); } catch { return {}; }
}

const todayStr = () => new Date().toISOString().split('T')[0];

function formatDate(d) {
  if (!d || d === '-') return '—';
  try {
    const date = new Date(d);
    if (isNaN(date)) return d;
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return d; }
}

/* ── Status Badge ── */
const STATUS_MAP = {
  'Done':'badge-done','Done 3.0':'badge-done','Done 3.5':'badge-done',
  'Pending':'badge-pending','Not Updated':'badge-updated','RFC':'badge-rfc',
};
function StatusBadge({ val }) {
  if (!val || val === '-' || val === '—') return <span style={{ color: '#cbd5e1' }}>—</span>;
  const cls = STATUS_MAP[val] ?? 'badge-done';
  return <span className={`badge ${cls}`}>{val}</span>;
}

const PAGE_SIZE = 8;
const AREAS_LIST = [];
const ACCT_TYPES    = ['Domestic','Commercial','Industrial'];
const STATUS_OPTIONS = ['—', 'Done', 'Pending'];
const METER_MAKES   = [];  // replaced by free-text input

// All default/built-in columns — user can hide any of these
const DEFAULT_COLS = [
  { key: 'acct',      label: 'Acct' },
  { key: 'bpNo',      label: 'BP No.' },
  { key: 'appNo',     label: 'App No.' },
  { key: 'name',      label: 'Name' },
  { key: 'mobile',    label: 'Mobile' },
  { key: 'houseNo',   label: 'House No.' },
  { key: 'floor',     label: 'Floor' },
  { key: 'area',      label: 'Area' },
  { key: 'city',      label: 'City' },
  { key: 'meterNo',   label: 'Meter No.' },
  { key: 'meterDate', label: 'Meter Date' },
  { key: 'gcStatus',  label: 'GC' },
  { key: 'giStatus',  label: 'GI' },
  { key: 'rfc',       label: 'RFC' },
  { key: 'ngStatus',  label: 'NG' },
  { key: 'gcDate',    label: 'GC Date' },
];

const DEFAULT_MATERIALS = [
  { key: 'pe20',      label: "20mm PE Pipe",          unit: 'mtr'  },
  { key: 'gi12',      label: "½\" GI Pipe",           unit: 'mtr'  },
  { key: 'tfFit',     label: 'TF Fitting',            unit: 'pcs'  },
  { key: 'ibv',       label: 'Isolation Ball Valve',  unit: 'pcs'  },
  { key: 'c32',       label: '32mm Coupler',          unit: 'pcs'  },
  { key: 'c63',       label: '63mm Coupler',          unit: 'pcs'  },
  { key: 'teflon',    label: 'Teflon Tape (rolls)',   unit: 'rolls' },
  { key: 'gasTap',    label: 'Gas Tap',               unit: 'pcs'  },
  { key: 'rubber',    label: 'Rubber Tube',           unit: 'mtr'  },
  { key: 'hoseClamp', label: 'Hose Clamp',            unit: 'pcs'  },
];

function loadMatList() {
  // Return the built-in default material list; custom materials added via UI are kept in component state only.
  return DEFAULT_MATERIALS;
}

const FLOORS = ['GF', 'FF', 'SF', 'TF', 'FoF'];
const FLOOR_LABELS_MAP = { GF: 'Ground Floor', FF: 'First Floor', SF: 'Second Floor', TF: 'Third Floor', FoF: 'Fourth Floor' };

const EMPTY_FORM_BASE = {
  bpNo:'', appNo:'', name:'', mobile:'', altMobile:'',
  acctType:'Domestic', houseNo:'', floor:'GF', address1:'', area:'', city:'',
  gcStatus:'—', giStatus:'—', rfc:'—', ngStatus:'—', gcDate:'',
  plumbingDate:'', gcLen:'', giLen:'', tf:'', iv:'',
  meterNo:'', meterDate:'', meterMake:'', meterReading:'', side:'LHS', meterPhotoFile:null,
};

function makeEmptyForm(matList) {
  const base = { ...EMPTY_FORM_BASE };
  matList.forEach(m => { base[m.key] = ''; });
  return base;
}

/* ── Delete Confirm Modal ── */
function ConfirmDelete({ onConfirm, onCancel }) {
  return (
    <div style={{ position:'fixed',inset:0,zIndex:1100,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}>
      <div style={{ background:'#fff',borderRadius:12,padding:28,maxWidth:360,width:'100%',boxShadow:'0 20px 60px rgba(0,0,0,0.25)',textAlign:'center' }}>
        <div style={{ fontSize:36,marginBottom:12 }}>🗑</div>
        <p style={{ fontSize:15,fontWeight:700,color:'#1e293b',marginBottom:6 }}>Delete this entry permanently?</p>
        <p style={{ fontSize:12,color:'#64748b',marginBottom:20 }}>This action cannot be undone.</p>
        <div style={{ display:'flex',gap:10 }}>
          <button onClick={onCancel} style={{ flex:1,height:38,background:'#f1f5f9',border:'1px solid #d1d5db',borderRadius:7,fontSize:13,fontWeight:600,cursor:'pointer',color:'#374151' }}>
            Cancel
          </button>
          <button onClick={onConfirm} style={{ flex:1,height:38,background:'#c0440a',border:'none',borderRadius:7,fontSize:13,fontWeight:600,cursor:'pointer',color:'#fff' }}>
            Yes, Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HouseTable() {
  const { showToast } = useToast();
  const { user }      = useContext(AuthContext);
  const { selectedSiteId, selGA, selCity, selArea, setSelGA, setSelCity, setSelArea, selectedSite, mergedGAs, getCitiesForGA, getAreasForCity, globalLocationContext, siteList, siteLoading } = useSite();
  const siteId        = selectedSiteId || null;
  const liveAreas = useSiteAreas(); // dynamic areas for selected GA location
  const [allHouses, setAllHouses] = useState([]);
  const [loadingHouses, setLoadingHouses] = useState(false);

  // 3-level form states for GA Location, City, Area
  const [formGA,   setFormGA]   = useState('');
  const [formCity, setFormCity] = useState('');
  const [formArea, setFormArea] = useState('');

  // Option lists
  const getAllCities = () => {
    return mergedGAs.flatMap(ga => ga.cities || []);
  };
  const cityOptions = formGA !== '' ? getCitiesForGA(formGA) : getAllCities();
  // For non-admin users, derive area options from formCity (set by the panelOpen useEffect).
  // Fallback: if formCity hasn't been set yet (one-render lag), compute the shared city
  // from siteList directly — works for any number of sites as long as they share one city.
  // NOTE: do NOT reference `isAdmin` here — it's declared later in the component (TDZ risk).
  // The cs.length===1 guard already prevents false positives for admins (many sites, many cities).
  const _fallbackCity = siteList.length > 0
    ? (() => { const cs = [...new Set(siteList.map(s => s.location || '').filter(Boolean))]; return cs.length === 1 ? cs[0] : ''; })()
    : '';
  const _areaCityId = formCity || _fallbackCity;
  const areaOptions = _areaCityId ? getAreasForCity(_areaCityId) : [];


  // ── Panel + edit state — MUST be declared BEFORE any useEffect that reads them ──
  const [panelOpen,    setPanelOpen]    = useState(false);
  const [editEntry,    setEditEntry]    = useState(null);

  // ── Table filter state — MUST be declared BEFORE the selGA sync useEffect ──
  const [filterAcct, setFilterAcct] = useState('');
  const [filterBP,   setFilterBP]   = useState('');
  const [page,       setPage]       = useState(1);
  const [tFilterGA,   setTFilterGA]   = useState('all');
  const [tFilterCity, setTFilterCity] = useState('all');
  const [tFilterArea, setTFilterArea] = useState('all');

  useEffect(() => {
    document.title = 'GP-PMS — PNG Connections';

    const isAdmin = user?.role === 'ADMIN';

    // ADMIN with no specific site selected — fetch ALL sites in parallel
    if (isAdmin && !siteId) {
      // Wait until siteList has loaded (guard against race condition D)
      if (siteLoading || siteList.length === 0) {
        console.log('[PNG FETCH]', { trigger: 'admin-all-sites-waiting', siteLoading, siteListLen: siteList.length });
        return;
      }
      setLoadingHouses(true);
      console.log('[PNG FETCH]', {
        trigger: 'admin-all-sites',
        siteCount: siteList.length,
        sites: siteList.map(s => s.name),
        isAdmin: true,
        urls: siteList.map(s => `/sites/${s.id}/png-connections`),
      });
      Promise.all(siteList.map(s => pngAPI.getAll(s.id)))
        .then(resultsPerSite => {
          const merged = resultsPerSite.flat();
          console.log('[PNG FETCH] admin-all-sites result:', merged.length, 'total connections across', siteList.length, 'sites');
          const mapped = merged.map(c => ({
            id:           c.id,
            bpNo:         c.bpNo         || '',
            appNo:        c.appNo        || '',
            name:         c.customerName || '',
            mobile:       c.mobile       || '',
            altMobile:    c.altMobile    || '',
            acctType:     c.accountType  || 'DOMESTIC',
            houseNo:      c.houseNo      || '',
            floor:        'GF',
            address1:     c.address1     || '',
            area:         c.society      || '',
            city:         c.city         || '',
            gcStatus:     c.status       || '—',
            giStatus:     c.giStatus     || '—',
            rfc:          c.rfcStatus    || (c.status === 'RFC' ? 'RFC' : '—'),
            ngStatus:     c.ngStatus     || '—',
            gcDate:       c.plumbingDate ? c.plumbingDate.split('T')[0] : '',
            plumbingDate: c.plumbingDate ? c.plumbingDate.split('T')[0] : '',
            meterNo:      c.meterNo      || c.meterInstallation?.serialNo || '',
            meterDate:    c.meterDate
                            ? c.meterDate.split('T')[0]
                            : (c.meterInstallation?.installationDate
                                ? c.meterInstallation.installationDate.split('T')[0] : ''),
            meterMake:    c.meterInstallation?.meterMake || '',
            meterReading: c.meterInstallation?.meterReading || '',
            side:         c.meterInstallation?.lhsRhs || 'LHS',
            materialsUsed: c.materialsUsed || {},
            photo1Data:   c.photo1Data   || null,
            photo2Data:   c.photo2Data   || null,
            photoCount:   [c.photo1Data, c.photo2Data].filter(Boolean).length,
            createdAt: c.createdAt,
          }));
          setAllHouses(mapped);
        })
        .catch(err => {
          console.error('[PNG FETCH] admin-all-sites fetch failed:', err);
          setAllHouses([]);
        })
        .finally(() => setLoadingHouses(false));
      return;
    }

    // Non-admin (or admin with an explicit site selected) — fetch single site
    if (siteId) {
      setLoadingHouses(true);
      console.log('[PNG FETCH]', {
        trigger: isAdmin ? 'admin-single-site' : 'worker-site',
        siteId,
        isAdmin,
        url: `/sites/${siteId}/png-connections`,
      });
      pngAPI.getAll(siteId)
        .then(connections => {
          // map backend PNGConnection shape to the frontend house shape
          const mapped = connections.map(c => ({
            id:           c.id,
            bpNo:         c.bpNo         || '',
            appNo:        c.appNo        || '',
            name:         c.customerName || '',
            mobile:       c.mobile       || '',
            altMobile:    c.altMobile    || '',
            acctType:     c.accountType  || 'DOMESTIC',
            houseNo:      c.houseNo      || '',
            floor:        'GF',
            address1:     c.address1     || '',
            area:         c.society      || '',
            city:         c.city         || '',
            gcStatus:     c.status       || '—',
            giStatus:     c.giStatus     || '—',
            rfc:          c.rfcStatus    || (c.status === 'RFC' ? 'RFC' : '—'),
            ngStatus:     c.ngStatus     || '—',
            gcDate:       c.plumbingDate ? c.plumbingDate.split('T')[0] : '',
            plumbingDate: c.plumbingDate ? c.plumbingDate.split('T')[0] : '',
            meterNo:      c.meterNo      || c.meterInstallation?.serialNo || '',
            meterDate:    c.meterDate
                            ? c.meterDate.split('T')[0]
                            : (c.meterInstallation?.installationDate
                                ? c.meterInstallation.installationDate.split('T')[0] : ''),
            meterMake:    c.meterInstallation?.meterMake || '',
            meterReading: c.meterInstallation?.meterReading || '',
            side:         c.meterInstallation?.lhsRhs || 'LHS',
            materialsUsed: c.materialsUsed || {},
            photo1Data:   c.photo1Data   || null,
            photo2Data:   c.photo2Data   || null,
            photoCount:   [c.photo1Data, c.photo2Data].filter(Boolean).length,
            createdAt: c.createdAt,
          }));
          setAllHouses(mapped);
        })
        .catch(err => {
          console.error('[PNG FETCH] single-site fetch failed:', err);
          setAllHouses([]);
        })
        .finally(() => setLoadingHouses(false));
    } else {
      setAllHouses([]);
    }
  }, [siteId, siteList, siteLoading, user?.role]);

  // Sync with global navbar GA selection
  useEffect(() => {
    setTFilterGA(selGA);
    setTFilterCity('all');
    setTFilterArea('all');
    setPage(1);
  }, [selGA]);

  // Auth / role checks — MUST be before the useEffect that reads isAdmin/assignedPairs in its dep array
  const session      = getSession();
  const isSupervisor = user?.role === 'SUPERVISOR';
  const siteAccess   = session.siteAccess;
  const isAdmin      = (
    user?.role === 'ADMIN' || user?.role === 'admin' ||
    ['oxygenprotech@gmail.com', 'radhe.sangwan1980@gmail.com']
      .includes((session.email || '').toLowerCase())
  );
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

  // Distinct GA names and city names across all assigned sites.
  // Used to decide: lock (1 unique value) vs dropdown (multiple unique values).
  const uniqueGAs    = useMemo(() => [...new Set(assignedPairs.map(p => p.gaName))],   [assignedPairs]);
  const uniqueCities = useMemo(() => [...new Set(assignedPairs.map(p => p.cityName))], [assignedPairs]);

  // Pre-fill and restrict GA / City / Area fields when panel opens or editEntry changes
  useEffect(() => {
    if (panelOpen) {
      if (editEntry) {
        // Resolve GA & City from editEntry's city and area
        let foundGAId = '';
        let foundCityId = '';
        for (const ga of mergedGAs) {
          const city = (ga.cities || []).find(c => c.label.toLowerCase() === (editEntry.city || '').toLowerCase() || c.id === editEntry.city);
          if (city) {
            foundGAId = ga.id;
            foundCityId = city.id;
            break;
          }
        }
        if (!foundGAId && editEntry.area) {
          for (const ga of mergedGAs) {
            const city = (ga.cities || []).find(c => (c.areas || []).includes(editEntry.area));
            if (city) {
              foundGAId = ga.id;
              foundCityId = city.id;
              break;
            }
          }
        }
        setFormGA(foundGAId || '');
        setFormCity(foundCityId || '');
        setFormArea(editEntry.area || '');
      } else {
        const ctx = globalLocationContext || { gaId: 'all', cityId: 'all', area: 'all' };
        if (ctx.gaId !== 'all') {
          // Navbar context is pinned — use it directly
          setFormGA(ctx.gaId);
          setFormCity(ctx.cityId !== 'all' ? ctx.cityId : '');
          setFormArea(ctx.area   !== 'all' ? ctx.area   : '');
        } else if (!isAdmin && assignedPairs.length > 0) {
          // Auto-set locked fields based on unique values across all assigned sites.
          if (uniqueGAs.length === 1) {
            setFormGA(uniqueGAs[0]);
          } else {
            setFormGA('');
          }
          if (uniqueCities.length === 1) {
            setFormCity(uniqueCities[0]);
          } else {
            setFormCity('');
          }
          setFormArea('');
        } else if (!isAdmin && mergedGAs.length === 1) {
          // Only one GA in system for this user
          setFormGA(mergedGAs[0].id);
          setFormCity('');
          setFormArea('');
        } else {
          setFormGA('');
          setFormCity('');
          setFormArea('');
        }
      }
    }
  }, [panelOpen, editEntry, globalLocationContext, mergedGAs, assignedPairs, isAdmin, uniqueGAs, uniqueCities]);


  const isViewOnly   = !isAdmin && (!siteAccess || siteAccess === 'none' || siteAccess === null);
  const canWrite     = !isViewOnly;

  const [catQtys, setCatQtys] = useState({});   // { 'catId__ItemName': qty }
  const [catOpen, setCatOpen] = useState(null);  // open category id

  const [modalHouse, setModalHouse] = useState(null);

  // Export state — default from 2020 to capture all historical data
  const [exportFrom,   setExportFrom]   = useState('2020-01-01');
  const [exportTo,     setExportTo]     = useState(todayStr());
  const [exportFilter, setExportFilter] = useState('all');

  // Dynamic global materials list (persistent)
  const [matList, setMatList] = useState(() => loadMatList());
  const EMPTY_FORM = makeEmptyForm(matList);
  const [form,         setForm]         = useState(EMPTY_FORM);
  const [errors,       setErrors]       = useState({});
  const [showDelete,   setShowDelete]   = useState(false);
  const [customMaterials, setCustomMaterials] = useState([]); // [{label, unit, qty}] per-entry extras
  const [hiddenMaterials, setHiddenMaterials] = useState([]); // keys hidden for THIS entry only

  // Stock categories from backend (for the materials accordion in the PNG Connection form)
  const [stockCatData, setStockCatData] = useState([]);
  useEffect(() => {
    dataAPI.getStockCategories()
      .then(cats => setStockCatData(buildAccordionCategories(cats, null)))
      .catch(() => setStockCatData([]));
  }, []);

  // Add a material permanently to the global list (component state only, not persisted)
  function addMaterialGlobal() {
    const label = prompt('Enter new material name:');
    if (!label || !label.trim()) return;
    const unit = prompt('Enter unit (e.g. pcs, mtr, rolls):') || 'pcs';
    const newMat = { key: 'cmat_' + Date.now(), label: label.trim(), unit: unit.trim() };
    setMatList(prev => [...prev, newMat]);
  }

  // Remove a material from the global list (component state only)
  function removeMaterialGlobal(key) {
    if (!window.confirm('Permanently remove this material from all future entries?')) return;
    setMatList(prev => prev.filter(m => m.key !== key));
  }

  // Dynamic custom columns state — now site-wide via backend (was per-browser localStorage)
  const [customCols, setCustomCols] = useState([]);

  // Hidden columns — site-wide via backend
  const [hiddenCols, setHiddenCols] = useState([]);
  const [showColManager, setShowColManager] = useState(false);
  const [newColNameHT, setNewColNameHT] = useState(''); // controlled input for col manager

  // Helper — persist column config to backend
  function saveColConfig(custom, hidden) {
    if (!siteId) return;
    columnConfigAPI.update(siteId, 'house', custom, hidden)
      .catch(e => console.error('[HouseTable] Failed to save column config:', e));
  }

  // Load column config from backend when siteId changes
  useEffect(() => {
    if (!siteId) return;
    columnConfigAPI.get(siteId, 'house')
      .then(cfg => {
        setCustomCols(cfg.customCols || []);
        setHiddenCols(cfg.hiddenCols || []);
      })
      .catch(() => { /* no config yet — start empty */ });
  }, [siteId]);

  function toggleColVisibility(key) {
    const updated = hiddenCols.includes(key)
      ? hiddenCols.filter(k => k !== key)
      : [...hiddenCols, key];
    setHiddenCols(updated);
    saveColConfig(customCols, updated);
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
    saveColConfig(updated, hiddenCols);
    showToast(`✓ Column "${name.trim()}" added`);
  };

  // Column manager replaces old number-prompt remove
  // handleRemoveColumn is now replaced by setShowColManager(true)

  // Dual photo state
  const [photo1,        setPhoto1]        = useState(null);
  const [photo1Preview, setPhoto1Preview] = useState(null);
  const [photo2,        setPhoto2]        = useState(null);
  const [photo2Preview, setPhoto2Preview] = useState(null);

  // Photo popover state (for table cell)
  const [photoPopover, setPhotoPopover] = useState(null); // houseId or null

  function reset() { setPage(1); }
  const f = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  /* Photo handler */
  const handlePhoto = (e, slot) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (slot === 1) { setPhoto1(file); setPhoto1Preview(url); }
    else            { setPhoto2(file); setPhoto2Preview(url); }
  };

  /* Convert file to base64 */
  const toBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
  });

  /* Photo utils */
  const viewPhoto = (data) => {
    const win = window.open();
    win.document.write(`<img src="${data}" style="max-width:100%;height:auto;background:#000" />`);
  };
  const downloadPhoto = (data, name) => {
    const a = document.createElement('a');
    a.href = data; a.download = name || 'photo.jpg';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const filtered = useMemo(() => (allHouses || []).filter(h => {
    if (filterAcct && h.acctType !== filterAcct) return false;
    if (filterBP   && !String(h.bpNo || '').toLowerCase().includes(filterBP.toLowerCase()) &&
                      !String(h.appNo || '').toLowerCase().includes(filterBP.toLowerCase())) return false;
    // 3-level location filter
    if (tFilterArea !== 'all' && h.area !== tFilterArea) return false;
    if (tFilterCity !== 'all') {
      const cityAreas = getAreasForCity(tFilterCity);
      if (cityAreas.length > 0 && !cityAreas.includes(h.area)) return false;
    }
    if (tFilterGA !== 'all') {
      const ga = mergedGAs.find(g => g.id === tFilterGA);
      if (ga) {
        const allGaAreas = (ga.cities || []).flatMap(c => c.areas || []);
        if (allGaAreas.length > 0 && !allGaAreas.includes(h.area)) return false;
      }
    }
    return true;
  }), [allHouses, filterAcct, filterBP, tFilterGA, tFilterCity, tFilterArea, mergedGAs, getAreasForCity]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const paged      = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  /* ── isDone / isPending helpers ── */
  function isDone(h) {
    const gc    = (h.gc    || h.gcStatus    || '').toLowerCase();
    const gi    = (h.gi    || h.giStatus    || '').toLowerCase();
    const rfc   = (h.rfc   || h.rfcStatus   || '').toLowerCase();
    const ng    = (h.ng    || h.ngStatus    || '').toLowerCase();
    const saral = (h.saral || h.saralStatus || '').toLowerCase();
    const meter = String(h.meter || h.meterNo || h.meterNumber || '');
    return (
      gc.includes('done') &&
      gi.includes('done') &&
      rfc.includes('done') &&
      ng.includes('done') &&
      saral === 'done' &&
      meter !== '' && meter !== '-' && meter !== '–' && meter !== 'null'
    );
  }

  /* ── Date-match helper — lenient (include if no date field) ── */
  function dateMatches(h) {
    const dateStr = h.createdAt || h.meterDate || h.plumbingDate || h.date || null;
    if (!dateStr) return true; // no date → always include
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return true;
      const from = new Date(exportFrom); from.setHours(0,0,0,0);
      const to   = new Date(exportTo);   to.setHours(23,59,59,999);
      return d >= from && d <= to;
    } catch { return true; }
  }

  /* ── Compute export-preview counts ── */
  const exportPreview = useMemo(() => {
    const inRange = (allHouses || []).filter(dateMatches);
    const doneCount    = inRange.filter(isDone).length;
    const pendingCount = inRange.length - doneCount;
    return { total: inRange.length, done: doneCount, pending: pendingCount };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allHouses, exportFrom, exportTo]);

  /* ── Export with Done/Pending filter ── */
  function handleExport() {
    let data = (allHouses || []).filter(dateMatches);

    if (exportFilter === 'done')    data = data.filter(isDone);
    else if (exportFilter === 'pending') data = data.filter(h => !isDone(h));

    console.log('Exporting', data.length, 'rows with filter:', exportFilter);

    const suffix = exportFilter === 'all'
      ? `All_${exportFrom}_to_${exportTo}`
      : `${exportFilter.charAt(0).toUpperCase() + exportFilter.slice(1)}_${exportFrom}_to_${exportTo}`;

    exportHouseData(data, exportFrom, exportTo, exportFilter, suffix);
  }

  /* ── Validate with auto-scroll to first error ── */
  function validateForm() {
    const e = {};
    if (!form.name.trim())     e.name     = 'Required';
    if (!form.mobile.trim())   e.mobile   = 'Required';
    else if (form.mobile.trim().length < 10) e.mobile = 'Must be at least 10 digits';
    if (!form.houseNo.trim())  e.houseNo  = 'Required';
    if (!form.address1.trim()) e.address1 = 'Required';
    if (!formGA)   e.ga   = 'Required';
    if (!formCity) e.city = 'Required';
    if (!formArea) e.area = 'Required';
    setErrors(e);

    // Scroll & focus to the first invalid field
    const fieldOrder = [
      { key: 'name',     id: 'ht-field-name'     },
      { key: 'mobile',   id: 'ht-field-mobile'   },
      { key: 'houseNo',  id: 'ht-field-houseNo'  },
      { key: 'address1', id: 'ht-field-address1' },
      { key: 'ga',       id: 'ht-field-ga'       },
      { key: 'city',     id: 'ht-field-city'     },
      { key: 'area',     id: 'ht-field-area'     },
    ];
    const first = fieldOrder.find(f => e[f.key]);
    if (first) {
      setTimeout(() => {
        const el = document.getElementById(first.id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.focus();
        }
      }, 50);
    }

    return Object.keys(e).length === 0;
  }

  /* ── Open Add panel ── */
  function openAddPanel() {
    setEditEntry(null);
    const initForm = { ...EMPTY_FORM };
    if (liveAreas && liveAreas.length > 0) {
      initForm.area = liveAreas[0];
    }
    customCols.forEach(c => { initForm[c.key] = ''; });
    setForm(initForm);
    setErrors({});
    setCustomMaterials([]);
    setHiddenMaterials([]);
    setCatQtys({});
    setCatOpen(null);
    setPhoto1(null); setPhoto1Preview(null);
    setPhoto2(null); setPhoto2Preview(null);
    setPanelOpen(true);
  }

  /* ── Open Edit panel ── */
  function openEditPanel(h) {
    setEditEntry(h);
    const initForm = {
      bpNo: h.bpNo || '', appNo: h.appNo || '', name: h.name || '',
      mobile: h.mobile || '', altMobile: h.altMobile || '',
      acctType: h.acctType || 'Domestic',
      houseNo: h.houseNo || '', floor: h.floor || 'GF',
      address1: h.address1 || '',
      area: h.area || 'UE-II', city: h.city || 'HISAR',
      gcStatus: h.gcStatus || '—', giStatus: h.giStatus || '—',
      rfc: h.rfc || '—', ngStatus: h.ngStatus || '—', gcDate: h.gcDate || '',
      plumbingDate: h.plumbingDate || '', gcLen: h.gcLen || '',
      giLen: h.giLen || '', tf: h.tf || '', iv: h.iv || '',
      meterNo: h.meterNo || '', meterDate: h.meterDate || '',
      meterMake: h.meterMake && h.meterMake !== 'Select' ? h.meterMake : '', meterReading: h.meterReading != null && h.meterReading !== 0 ? h.meterReading : '',
      side: h.side || 'LHS',
    };
    // materialsUsed from backend is an array [{material, qty, unit}].
    // Convert to a label→qty map so matList.forEach can look up by name.
    const savedMatsMap = {};
    if (Array.isArray(h.materialsUsed)) {
      h.materialsUsed.forEach(m => { if (m.material) savedMatsMap[m.material] = m.qty; });
    } else if (h.materialsUsed && typeof h.materialsUsed === 'object') {
      // legacy object shape {label: {qty, unit}} — keep backward compat
      Object.entries(h.materialsUsed).forEach(([k, v]) => { savedMatsMap[k] = v?.qty ?? v; });
    }

    // Build a set of matList labels so we can avoid restoring them into the accordion
    const matListNames = new Set(matList.map(m => m.label));

    // Restore matList form fields (PRIMARY source for overlapping materials)
    matList.forEach(m => {
      const qty = savedMatsMap[m.label];
      initForm[m.key] = qty !== undefined && qty !== 0 ? qty : '';
    });

    // Restore stock category material quantities (SECONDARY)
    // ONLY restore here if the material is NOT in the top matList
    const initCatQtys = {};
    stockCatData.forEach(cat => {
      cat.items.forEach(item => {
        if (matListNames.has(item)) return; // Already restored in the top list!
        const qty = savedMatsMap[item];
        if (qty !== undefined && qty !== 0) {
          initCatQtys[`${cat.id}__${item}`] = qty;
        }
      });
    });
    setCatQtys(initCatQtys);

    customCols.forEach(c => { initForm[c.key] = h.customFields?.[c.key] ?? h[c.key] ?? ''; });
    setForm(initForm);
    setErrors({});
    setCustomMaterials(h.customMaterials || []);
    setHiddenMaterials(h.hiddenMaterials || []);
    setPhoto1(null); setPhoto1Preview(null);
    setPhoto2(null); setPhoto2Preview(null);
    setShowDelete(false);
    setPanelOpen(true);
  }

  /* ── Save (add or update) — uploads photos to R2 before save ── */
  async function handleSave() {
    if (!validateForm()) return;

    // Upload photos to Cloudflare R2 if new files selected
    let p1url = null;
    let p2url = null;
    if (photo1) {
      console.log('🔵 PNG Photo 1 upload starting:', photo1.name, photo1.size, 'bytes', photo1.type);
      try {
        const p1b64 = await toBase64(photo1);
        p1url = await uploadAPI.uploadPhoto(p1b64, `png_photo1_${form.appNo || 'house'}`);
        console.log('🟢 PNG Photo 1 uploaded:', p1url);
      } catch (err) {
        console.error('❌ PNG Photo 1 upload FAILED:', err?.message, err?.response?.status, err?.response?.data, err);
        showToast(`✗ Photo 1 upload failed: ${err?.response?.data?.error || err?.message || 'Upload error'}`, 'error');
        return; // abort save — don't save with missing photo
      }
    }
    if (photo2) {
      console.log('🔵 PNG Photo 2 upload starting:', photo2.name, photo2.size, 'bytes', photo2.type);
      try {
        const p2b64 = await toBase64(photo2);
        p2url = await uploadAPI.uploadPhoto(p2b64, `png_photo2_${form.appNo || 'house'}`);
        console.log('🟢 PNG Photo 2 uploaded:', p2url);
      } catch (err) {
        console.error('❌ PNG Photo 2 upload FAILED:', err?.message, err?.response?.status, err?.response?.data, err);
        showToast(`✗ Photo 2 upload failed: ${err?.response?.data?.error || err?.message || 'Upload error'}`, 'error');
        return;
      }
    }
    console.log('🔵 PNG final photo URLs before save — photo1Data:', p1url, '| photo2Data:', p2url);

    // Step 1: matList form fields (Primary)
    const matMergeMap = {};
    matList.forEach(mat => {
      const qty = form[mat.key] || 0;
      if (qty > 0) matMergeMap[mat.label] = { qty, unit: mat.unit };
    });
    // Step 2: catQtys (Accordion — add to existing if user typed in both places)
    Object.entries(catQtys).forEach(([key, qty]) => {
      if (qty > 0) {
        const [, ...parts] = key.split('__');
        const name = parts.join('__');
        if (matMergeMap[name]) {
          matMergeMap[name].qty += qty;
        } else {
          matMergeMap[name] = { qty, unit: 'pcs' };
        }
      }
    });
    // Step 3: custom per-entry materials
    customMaterials.forEach(mat => {
      if (mat.label?.trim() && mat.qty > 0) {
        matMergeMap[mat.label.trim()] = { qty: mat.qty, unit: mat.unit || 'pcs' };
      }
    });

    const materialsUsed = matMergeMap; // kept for local state update below
    const materialsUsedPayload = Object.entries(matMergeMap)
      .map(([material, v]) => ({ material, qty: Number(v.qty), unit: v.unit || 'pcs' }));
    const finalCityLabel = mergedGAs
      .flatMap(g => g.cities || [])
      .find(c => c.id === formCity)?.label || formCity;

    // Resolve the correct siteId for this entry.
    // Priority:
    // 1. Non-admin with assigned pairs: look up by GA+City from the pair directly (reliable)
    // 2. Admin or fallback: use the triple gaName+location+chargeArea string match
    // 3. Last resort: selectedSiteId from context
    let resolvedSiteId = null;
    if (!isAdmin && assignedPairs.length > 0) {
      const pair = assignedPairs.find(p =>
        p.gaName.toLowerCase() === (formGA || '').toLowerCase() &&
        p.cityName.toLowerCase() === (formCity || '').toLowerCase()
      );
      resolvedSiteId = pair?.siteId ?? (assignedPairs.length === 1 ? assignedPairs[0].siteId : null);
    }
    if (!resolvedSiteId) {
      // Admin or non-admin fallback: try the full 3-field match
      const targetSite = siteList.find(s =>
        s.gaName?.toLowerCase() === formGA?.toLowerCase() &&
        s.location?.toLowerCase() === formCity?.toLowerCase() &&
        s.chargeArea?.toLowerCase() === formArea?.toLowerCase()
      );
      resolvedSiteId = targetSite?.id ?? siteId ?? null;
    }

    if (!resolvedSiteId) {
      showToast('❌ No matching site found for selected GA, City, and Area.', 'error');
      return;
    }

    try {
      const payload = {
        appNo: form.appNo, bpNo: form.bpNo || null,
        accountType: (form.acctType || 'DOMESTIC').toUpperCase(),
        customerName: form.name, mobile: form.mobile, altMobile: form.altMobile || null,
        houseNo: form.houseNo || '', address1: form.address1 || '',
        city: finalCityLabel, society: formArea || null,
        status: form.gcStatus !== '—' ? form.gcStatus : 'Pending',
        plumbingDate: form.gcDate || null,
        // Status fields — now saved to DB (were frontend-only before)
        giStatus:  form.giStatus  !== '—' ? form.giStatus  : null,
        rfcStatus: form.rfc       !== '—' ? form.rfc       : null,
        ngStatus:  form.ngStatus  !== '—' ? form.ngStatus  : null,
        // Quick meter recording
        meterNo:   form.meterNo   || null,
        meterDate: form.meterDate || null,
        // Photos — send R2 URL if a new file was selected; undefined = keep existing in DB
        photo1Data: p1url || undefined,
        photo2Data: p2url || undefined,
        // Deduped materials payload — catQtys take priority over matList when names overlap
        materialsUsed: materialsUsedPayload,
        // Custom column values grouped into one JSON field
        customFields: Object.fromEntries(customCols.map(c => [c.key, form[c.key] || ''])),
      };
      if (editEntry) {
        await pngAPI.update(resolvedSiteId, editEntry.id, payload);
        setAllHouses(prev => prev.map(h => h.id === editEntry.id
          ? { ...h, ...{ bpNo: form.bpNo, appNo: form.appNo, name: form.name,
              mobile: form.mobile, altMobile: form.altMobile,
              acctType: form.acctType, houseNo: form.houseNo, floor: form.floor,
              address1: form.address1, area: formArea, city: finalCityLabel,
              gcStatus: form.gcStatus, giStatus: form.giStatus,
              rfc: form.rfc, ngStatus: form.ngStatus, gcDate: form.gcDate,
              plumbingDate: form.plumbingDate, meterNo: form.meterNo,
              meterDate: form.meterDate, meterMake: form.meterMake,
              meterReading: form.meterReading, side: form.side,
              // BUG FIX: use R2 URLs (p1url/p2url), not base64 (p1b64/p2b64)
              photo1Data: p1url || h.photo1Data, photo1Name: photo1?.name || h.photo1Name,
              photo2Data: p2url || h.photo2Data, photo2Name: photo2?.name || h.photo2Name,
              photoCount: [p1url || h.photo1Data, p2url || h.photo2Data].filter(Boolean).length,
              materialsUsed, customMaterials: customMaterials.filter(m => m.label.trim()),
              hiddenMaterials,
              customFields: Object.fromEntries(customCols.map(c => [c.key, form[c.key] || ''])),
              updatedAt: new Date().toISOString() } } : h));
        showToast('✓ Entry updated successfully');
      } else {
        const created = await pngAPI.create(resolvedSiteId, payload);
          const newEntry = {
            id: created?.id || Date.now(),
            bpNo: form.bpNo, name: form.name, mobile: form.mobile,
            appNo: form.appNo, altMobile: form.altMobile,
            acctType: form.acctType, houseNo: form.houseNo, floor: form.floor,
            address1: form.address1, area: formArea, city: finalCityLabel,
            meterNo: form.meterNo, meterDate: form.meterDate,
            meterMake: form.meterMake, meterReading: form.meterReading,
            gcStatus: form.gcStatus, giStatus: form.giStatus,
            rfc: form.rfc, ngStatus: form.ngStatus, gcDate: form.gcDate,
            plumbingDate: form.plumbingDate, side: form.side,
            // BUG FIX: use R2 URLs (p1url/p2url), not the deleted p1b64/p2b64 vars
            photo1Data: p1url || null, photo1Name: photo1?.name || null,
            photo2Data: p2url || null, photo2Name: photo2?.name || null,
            photoCount: [p1url, p2url].filter(Boolean).length,
            materialsUsed,
            customMaterials: customMaterials.filter(m => m.label.trim()),
            hiddenMaterials,
            customFields: Object.fromEntries(customCols.map(c => [c.key, form[c.key] || ''])),
            createdAt: new Date().toISOString(),
          };
          setAllHouses(prev => [newEntry, ...prev]);
          showToast('✓ Entry saved successfully');
        }

        setPanelOpen(false); setForm(EMPTY_FORM); setErrors({});
        setPhoto1(null); setPhoto1Preview(null); setPhoto2(null); setPhoto2Preview(null);
        setCustomMaterials([]);
        setHiddenMaterials([]);
        setCatQtys({});
        setCatOpen(null);
      } catch (err) {
        console.error('PNG API save error:', err);
        const errData = err?.response?.data;
        if (errData?.field === 'materialsUsed' || errData?.insufficientItems?.length > 0 || errData?.missingItems?.length > 0) {
          // Stock pre-flight failure — show per-item requested vs available detail
          const items = errData.insufficientItems || [];
          const msg = items.length > 0
            ? `⚠️ Insufficient stock:\n${items.map(i => `• ${i.name}: need ${i.requested}, only ${i.available} available`).join('\n')}\n\nReceive more stock in Inventory first.`
            : (errData.error || '⚠️ Some materials are not in inventory.');
          showToast(msg, 'error');
        } else if (errData?.field && errData?.error) {
          setErrors(prev => ({ ...prev, [errData.field]: errData.error }));
        } else {
          showToast(`❌ ${errData?.error || 'Save failed. Please try again.'}`, 'error');
        }
        return;
      }
  }

  async function handleDelete() {
    if (!editEntry) return;

    console.log('🔵 Sending delete request for:', editEntry.id, `(${editEntry.name})`);

    try {
      await pngAPI.delete(siteId, editEntry.id);
      console.log('🟢 Delete API call succeeded for:', editEntry.id);

      // Remove from local state only AFTER backend confirms deletion
      setAllHouses(prev => prev.filter(h => h.id !== editEntry.id));
      setPanelOpen(false);
      setEditEntry(null);
      setShowDelete(false);
      showToast('✓ Entry deleted');
    } catch (error) {
      console.error('❌ Delete failed:', error);
      setShowDelete(false);
      showToast('❌ Delete failed — entry was not removed. Check connection and try again.');
    }
  }

  const panelTitle = editEntry ? `Edit Entry — ${editEntry.name || 'Entry'}` : 'Add House Connection Entry';

  /* ── Shared form body (used for both add and edit) ── */
  function FormBody() {
    return (
      <>
        <div>
          <SectionTitle>1. Customer Details</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="BP Number (optional)" error={errors.bpNo}><Input value={form.bpNo} onChange={val => f('bpNo', val)} error={errors.bpNo} /></Field>
              <Field label="Application No." error={errors.appNo}><Input value={form.appNo} onChange={val => f('appNo', val)} error={errors.appNo} /></Field>
            </div>
            <Field label="Customer Name" required error={errors.name}><Input id="ht-field-name" value={form.name} onChange={val => f('name', val)} error={errors.name} /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Mobile" required error={errors.mobile}><Input id="ht-field-mobile" type="tel" value={form.mobile} onChange={val => f('mobile', val)} error={errors.mobile} /></Field>
              <Field label="Alt Mobile"><Input type="tel" value={form.altMobile} onChange={val => f('altMobile', val)} /></Field>
            </div>
            <Field label="Account Type" required><Select value={form.acctType} onChange={val => f('acctType', val)}>{ACCT_TYPES.map(t => <option key={t}>{t}</option>)}</Select></Field>
          </div>
        </div>
        <div>
          <SectionTitle>2. Address</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="House No." required error={errors.houseNo}><Input id="ht-field-houseNo" value={form.houseNo} onChange={val => f('houseNo', val)} error={errors.houseNo} /></Field>
              <Field label="Floor">
                <Select value={form.floor || 'GF'} onChange={val => f('floor', val)}>
                  {FLOORS.map(fl => <option key={fl} value={fl}>{fl} — {FLOOR_LABELS_MAP[fl]}</option>)}
                </Select>
              </Field>
            </div>
             <Field label="Address Line 1" required error={errors.address1}><Input id="ht-field-address1" value={form.address1} onChange={val => f('address1', val)} error={errors.address1} /></Field>
             <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
               <Field label="GA Location" required error={errors.ga}>
                 {!isAdmin && uniqueGAs.length === 1 ? (
                   // Single unique GA across all assigned sites — lock as text
                   <div style={{ fontSize: 13, fontWeight: 600, color: '#1f4e1a', padding: '8px 10px', background: '#f0f7ee', border: '1px solid #c6e0c0', borderRadius: 5 }}>
                     {uniqueGAs[0]}
                   </div>
                 ) : !isAdmin && uniqueGAs.length > 1 ? (
                   // Multiple different GAs — show GA dropdown limited to assigned GAs
                   <Select
                     id="ht-field-ga"
                     value={formGA}
                     onChange={val => { setFormGA(val); setFormCity(''); setFormArea(''); }}
                     error={errors.ga}
                   >
                     <option value="">Select GA Location</option>
                     {uniqueGAs.map(g => <option key={g} value={g}>{g}</option>)}
                   </Select>
                 ) : (
                   // Admin: full open dropdown
                   <Select
                     id="ht-field-ga"
                     value={formGA}
                     onChange={val => {
                       setFormGA(val);
                       setFormCity('');
                       setFormArea('');
                     }}
                     error={errors.ga}
                   >
                     <option value="">Select GA Location</option>
                     {mergedGAs.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                   </Select>
                 )}
               </Field>
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                 <Field label="City" required error={errors.city}>
                   {!isAdmin && uniqueCities.length === 1 ? (
                     // Single unique city across all assigned sites — lock as text
                     <div style={{ fontSize: 13, fontWeight: 600, color: '#1f4e1a', padding: '8px 10px', background: '#f0f7ee', border: '1px solid #c6e0c0', borderRadius: 5 }}>
                       {uniqueCities[0]}
                     </div>
                   ) : !isAdmin && uniqueCities.length > 1 ? (
                     // Multiple different cities — show City dropdown limited to assigned cities
                     <Select
                       id="ht-field-city"
                       value={formCity}
                       onChange={val => { setFormCity(val); setFormArea(''); }}
                       error={errors.city}
                     >
                       <option value="">Select City</option>
                       {uniqueCities.map(c => <option key={c} value={c}>{c}</option>)}
                     </Select>
                   ) : (
                     // Admin: full open city dropdown
                     <Select
                       id="ht-field-city"
                       value={formCity}
                       onChange={val => {
                         setFormCity(val);
                         setFormArea('');
                       }}
                       error={errors.city}
                     >
                       <option value="">Select City</option>
                       {cityOptions.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                     </Select>
                   )}
                 </Field>
                 <Field label="Area / Society" required error={errors.area}>
                    {areaOptions.length > 0 ? (
                      <Select
                        id="ht-field-area"
                        value={formArea}
                        onChange={val => {
                          console.log('🔵 [PNG Connection] Area onChange fired, new value:', val);
                          setFormArea(val);
                        }}
                        error={errors.area}
                      >
                        <option value="">Select Area</option>
                        {/* Always include the current value as an option when editing so it shows correctly */}
                        {formArea && !areaOptions.includes(formArea) && (
                          <option value={formArea}>{formArea}</option>
                        )}
                        {areaOptions.map(a => <option key={a} value={a}>{a}</option>)}
                      </Select>
                    ) : (
                      // No pre-defined charge areas for this site — allow free-text entry
                      <Input
                        id="ht-field-area"
                        value={formArea}
                        onChange={val => setFormArea(val)}
                        error={errors.area}
                        placeholder={formCity ? 'Enter area / society name' : 'Select GA & City first'}
                      />
                    )}
                 </Field>
               </div>
             </div>
          </div>
        </div>
        <div>
          <SectionTitle>3. Work Status</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="GC Status"><Select value={form.gcStatus} onChange={val => f('gcStatus', val)}>{STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}</Select></Field>
            <Field label="GI Status"><Select value={form.giStatus} onChange={val => f('giStatus', val)}>{STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}</Select></Field>
            <Field label="RFC Status"><Select value={form.rfc} onChange={val => f('rfc', val)}>{STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}</Select></Field>
            <Field label="NG Status"><Select value={form.ngStatus} onChange={val => f('ngStatus', val)}>{STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}</Select></Field>
            <Field label="GC Date"><Input id="ht-field-gcDate" type="date" value={form.gcDate} onChange={val => f('gcDate', val)} /></Field>
            <Field label="Plumbing Date"><Input type="date" value={form.plumbingDate} onChange={val => f('plumbingDate', val)} /></Field>
          </div>
        </div>
          {/* Section 4: Meter Details */}
          <SectionTitle>4. Meter Details</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Meter No."><Input value={form.meterNo} onChange={val => f('meterNo', val)} /></Field>
            <Field label="Meter Date"><Input type="date" value={form.meterDate} onChange={val => f('meterDate', val)} /></Field>
            <Field label="Meter Make"><Input value={form.meterMake} placeholder="e.g. Itron, Elster, etc." onChange={val => f('meterMake', val)} /></Field>
            <Field label="Meter Reading"><Input type="number" min={0} value={form.meterReading} onChange={val => f('meterReading', val)} /></Field>
          </div>
          <Field label="Side" style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
              {['LHS','RHS'].map(s => (
                <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                  <input type="radio" name="side" value={s} checked={form.side === s} onChange={() => f('side', s)} style={{ accentColor: '#2d6a27' }} />{s}
                </label>
              ))}
            </div>
          </Field>

          {/* House Photos — Two slots */}
          <div style={{ marginTop: 12, marginBottom: 4 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 8, color: '#374151' }}>House Photos</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>

              {/* Photo 1 */}
              <div>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 500 }}>Photo 1 — Meter / Connection</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  <div onClick={() => document.getElementById('cam1').click()}
                    style={{ border: '1px dashed #2d6a27', borderRadius: 5, padding: '10px 6px', textAlign: 'center', cursor: 'pointer', color: '#2d6a27', fontSize: 10, fontWeight: 600 }}>📷 Camera</div>
                  <div onClick={() => document.getElementById('gal1').click()}
                    style={{ border: '1px dashed #2d6a27', borderRadius: 5, padding: '10px 6px', textAlign: 'center', cursor: 'pointer', color: '#2d6a27', fontSize: 10, fontWeight: 600 }}>🖼 Gallery</div>
                </div>
                <input id="cam1" type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => handlePhoto(e, 1)} />
                <input id="gal1" type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handlePhoto(e, 1)} />
                {photo1Preview && (
                  <div style={{ marginTop: 6 }}>
                    <img src={photo1Preview} style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 4, border: '1px solid #d1d5db' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 }}>
                      <span style={{ fontSize: 10, color: '#2d6a27' }}>✓ Photo 1 ready</span>
                      <button type="button" onClick={() => { setPhoto1(null); setPhoto1Preview(null); }} style={{ fontSize: 10, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Photo 2 */}
              <div>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 500 }}>Photo 2 — Additional / Site</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  <div onClick={() => document.getElementById('cam2').click()}
                    style={{ border: '1px dashed #2d6a27', borderRadius: 5, padding: '10px 6px', textAlign: 'center', cursor: 'pointer', color: '#2d6a27', fontSize: 10, fontWeight: 600 }}>📷 Camera</div>
                  <div onClick={() => document.getElementById('gal2').click()}
                    style={{ border: '1px dashed #2d6a27', borderRadius: 5, padding: '10px 6px', textAlign: 'center', cursor: 'pointer', color: '#2d6a27', fontSize: 10, fontWeight: 600 }}>🖼 Gallery</div>
                </div>
                <input id="cam2" type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => handlePhoto(e, 2)} />
                <input id="gal2" type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handlePhoto(e, 2)} />
                {photo2Preview && (
                  <div style={{ marginTop: 6 }}>
                    <img src={photo2Preview} style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 4, border: '1px solid #d1d5db' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 }}>
                      <span style={{ fontSize: 10, color: '#2d6a27' }}>✓ Photo 2 ready</span>
                      <button type="button" onClick={() => { setPhoto2(null); setPhoto2Preview(null); }} style={{ fontSize: 10, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        <div>
          <SectionTitle>5. Materials Used</SectionTitle>
          <p style={{ fontSize: 11, color: '#64748b', marginBottom: 10, background: '#fef3c7', padding: '6px 10px', borderRadius: 4 }}>
            ⚠ Quantities entered here will be deducted from site stock.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {matList.filter(mat => !hiddenMaterials.includes(mat.key)).map(mat => (
              <div key={mat.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ flex: 1, fontSize: 12, color: '#374151' }}>{mat.label}</label>
                <span style={{ fontSize: 11, color: '#94a3b8', width: 32 }}>{mat.unit}</span>
                <input type="number" min={0}
                  value={form[mat.key] !== undefined && form[mat.key] !== null && form[mat.key] !== 0 ? form[mat.key] : ''}
                  onFocus={e => e.target.select()}
                  onChange={e => f(mat.key, e.target.value === '' ? 0 : Number(e.target.value))}
                  onBlur={e => { if (e.target.value === '') f(mat.key, 0); }}
                  placeholder="0"
                  style={{ width: 72, height: 30, border: '1px solid #d1d5db', borderRadius: 4, padding: '0 8px', fontSize: 13 }} />
                {/* × hide for this entry only */}
                <button type="button"
                  onClick={() => setHiddenMaterials(prev => [...prev, mat.key])}
                  title="Hide for this entry only"
                  style={{ width: 26, height: 30, background: '#fef9c3', color: '#92400e', border: '1px solid #fde68a', borderRadius: 4, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 700 }}
                >−</button>
                {/* 🗑 permanently delete from global list */}
                <button type="button"
                  onClick={() => removeMaterialGlobal(mat.key)}
                  title="Permanently delete this material"
                  style={{ width: 26, height: 30, background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                >&#x1F5D1;</button>
              </div>
            ))}
            {/* Custom per-entry materials */}
            {customMaterials.map((mat, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  value={mat.label}
                  onChange={e => setCustomMaterials(prev => prev.map((m, i) => i === idx ? { ...m, label: e.target.value } : m))}
                  placeholder="Material name"
                  style={{ flex: 1, height: 30, border: '1px solid #d1d5db', borderRadius: 4, padding: '0 8px', fontSize: 12 }}
                />
                <input
                  value={mat.unit}
                  onChange={e => setCustomMaterials(prev => prev.map((m, i) => i === idx ? { ...m, unit: e.target.value } : m))}
                  placeholder="unit"
                  style={{ width: 48, height: 30, border: '1px solid #d1d5db', borderRadius: 4, padding: '0 6px', fontSize: 12 }}
                />
                <input
                  type="number" min={0}
                  value={mat.qty !== 0 ? mat.qty : ''}
                  onFocus={e => e.target.select()}
                  onChange={e => setCustomMaterials(prev => prev.map((m, i) => i === idx ? { ...m, qty: e.target.value === '' ? 0 : Number(e.target.value) } : m))}
                  onBlur={e => { if (e.target.value === '') setCustomMaterials(prev => prev.map((m, i) => i === idx ? { ...m, qty: 0 } : m)); }}
                  placeholder="0"
                  style={{ width: 68, height: 30, border: '1px solid #d1d5db', borderRadius: 4, padding: '0 6px', fontSize: 13 }}
                />
                <button type="button" onClick={() => setCustomMaterials(prev => prev.filter((_, i) => i !== idx))}
                  style={{ width: 26, height: 30, background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                >×</button>
              </div>
            ))}

            {/* ── Stock Category Dropdowns ── */}
            <div style={{ marginTop: 12, borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
              <p style={{ fontSize: 11, color: '#64748b', marginBottom: 8, fontWeight: 600 }}>
                Additional Materials from Stock Categories:
              </p>
              {stockCatData.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: 12, margin: '4px 0' }}>No stock categories loaded from server.</p>
              ) : stockCatData.map(cat => {
                const isOpen = catOpen === cat.id;
                return (
                  <div key={cat.id} style={{ border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden', marginBottom: 6 }}>
                    {/* Category header */}
                    <div
                      onClick={() => setCatOpen(prev => prev === cat.id ? null : cat.id)}
                      style={{
                        background: isOpen ? cat.color : '#f8fafc',
                        color: isOpen ? 'white' : '#1e293b',
                        padding: '9px 12px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontWeight: 600,
                        fontSize: 12,
                        transition: 'background 0.15s',
                      }}
                    >
                      <span>{cat.label}</span>
                      <span style={{ fontSize: 11 }}>{isOpen ? '▲' : '▼'}</span>
                    </div>

                    {/* Items */}
                    {isOpen && (
                      <div style={{ padding: '8px 12px', background: 'white', display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {cat.items.map(item => {
                          const key = `${cat.id}__${item}`;
                          const val = catQtys[key] || 0;
                          return (
                            <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <label style={{ flex: 1, fontSize: 11.5, color: '#374151', lineHeight: 1.3 }}>{item}</label>
                              <input
                                type="number" min={0}
                                value={val === 0 ? '' : val}
                                onFocus={e => e.target.select()}
                                onChange={e => {
                                  const num = e.target.value === '' ? 0 : Number(e.target.value);
                                  setCatQtys(prev => ({ ...prev, [key]: num }));
                                }}
                                onBlur={e => {
                                  if (e.target.value === '') setCatQtys(prev => ({ ...prev, [key]: 0 }));
                                }}
                                placeholder="0"
                                style={{ width: 70, height: 28, border: '1px solid #d1d5db', borderRadius: 4, padding: '0 6px', fontSize: 12, textAlign: 'right' }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add persistent material to global list */}
            <button
              type="button"
              onClick={addMaterialGlobal}
              style={{ marginTop: 4, height: 32, background: '#2d6a27', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              + Add Material to List
            </button>
          </div>
        </div>
      </>
    );
  }


  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
        {/* Export bar */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>From</span>
          <input type="date" value={exportFrom} onChange={e => setExportFrom(e.target.value)}
            style={{ height: 32, border: '1px solid #d1d5db', borderRadius: 4, padding: '0 8px', fontSize: 12 }} />
          <span style={{ fontSize: 12, color: '#64748b' }}>to</span>
          <input type="date" value={exportTo} onChange={e => setExportTo(e.target.value)}
            style={{ height: 32, border: '1px solid #d1d5db', borderRadius: 4, padding: '0 8px', fontSize: 12 }} />
          <select value={exportFilter} onChange={e => setExportFilter(e.target.value)}
            style={{ height: 32, border: '1px solid #d1d5db', borderRadius: 4, padding: '0 8px', fontSize: 12, background: 'white' }}>
            <option value="all">All Entries</option>
            <option value="done">Done Only</option>
            <option value="pending">Pending Only</option>
          </select>
          <button onClick={handleExport}
            style={{ height: 32, background: '#2d6a27', color: '#fff', border: 'none', borderRadius: 4, padding: '0 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            ↓ Export Excel
          </button>
          {canWrite && (
            <>
              <button onClick={() => setShowColManager(true)}
                style={{ height: 32, background: '#2d6a27', color: '#fff', border: 'none', borderRadius: 4, padding: '0 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                ⚙ Manage Columns
              </button>
              <button onClick={openAddPanel}
                style={{ height: 32, background: '#1f4e1a', color: '#fff', border: 'none', borderRadius: 4, padding: '0 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                + Add New Entry
              </button>
            </>
          )}
        </div>
      </div>
      <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10, textAlign: 'right' }}>
        Default shows all historical data &nbsp;|&nbsp;
        <span style={{ color: '#16a34a', fontWeight: 600 }}>{exportPreview.done} Done</span>&nbsp;
        / <span style={{ color: '#dc2626', fontWeight: 600 }}>{exportPreview.pending} Pending</span>&nbsp;
        / {exportPreview.total} Total in selected range
      </p>
          {/* Filter bar — 3-level location + Account Type + BP/App No */}
          <div className="card section-block" style={{ padding: '10px 14px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              {/* Account type */}
              <select className="gp-select-dark" style={{ width: 140 }} value={filterAcct} onChange={e => { setFilterAcct(e.target.value); reset(); }}>
                <option value="">All Types</option>
                {ACCT_TYPES.map(a => <option key={a}>{a}</option>)}
              </select>
              {/* GA Location */}
              <select className="gp-select-dark" style={{ width: 130 }} value={tFilterGA} onChange={e => { setTFilterGA(e.target.value); setTFilterCity('all'); setTFilterArea('all'); reset(); }}>
                <option value="all">All GA</option>
                {mergedGAs.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
              </select>
              {/* City */}
              <select className="gp-select-dark" style={{ width: 120 }} value={tFilterCity} disabled={tFilterGA === 'all'} onChange={e => { setTFilterCity(e.target.value); setTFilterArea('all'); reset(); }}>
                <option value="all">All Cities</option>
                {getCitiesForGA(tFilterGA).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              {/* Area */}
              <select className="gp-select-dark" style={{ width: 120 }} value={tFilterArea} disabled={tFilterCity === 'all'} onChange={e => { setTFilterArea(e.target.value); reset(); }}>
                <option value="all">All Areas</option>
                {getAreasForCity(tFilterCity).map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              {/* BP / App No search */}
              <input className="gp-input-dark" style={{ width: 140 }} placeholder="BP / App No." value={filterBP} onChange={e => { setFilterBP(e.target.value); reset(); }} />
              <button className="btn btn-primary" onClick={() => { setFilterAcct(''); setTFilterGA('all'); setTFilterCity('all'); setTFilterArea('all'); setFilterBP(''); reset(); }}>Clear</button>
            </div>
          </div>

      <p style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>
        Showing page {page} of {totalPages} — {filtered.length} entries
      </p>

      {/* Site data label — only when real GA+City+Area has been selected */}
      {selGA && selGA !== 'all' && selCity && selCity !== 'all' && selArea && selArea !== 'all' && (() => {
        const gaObj   = mergedGAs.find(g => g.id === selGA);
        const cityObj = gaObj?.cities?.find(c => c.id === selCity);
        const label   = [gaObj?.name, cityObj?.name, selArea].filter(Boolean).join(' — ');
        return label ? (
          <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'#fff0f3', border:'1px solid #f9a8d4', borderRadius:6, padding:'4px 10px', fontSize:11, color:'#be185d', fontWeight:600, marginBottom:8 }}>
            📍 {label}
          </div>
        ) : null;
      })()}

      <div className="card section-block" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="gp-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>Sr.</th>
                {DEFAULT_COLS.filter(c => !hiddenCols.includes(c.key)).map(c => <th key={c.key}>{c.label}</th>)}
                {customCols.filter(c => !hiddenCols.includes(c.key)).map(col => <th key={col.key}>{col.label}</th>)}
                <th>Photo</th>
                <th>Action</th>
                {canWrite && <th>&#9998;</th>}
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr><td colSpan={17 + customCols.length} style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                  <div style={{ fontSize: 32 }}>📋</div>
                  <div style={{ marginTop: 8, fontSize: 14 }}>No entries found</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Try adjusting your filters or add a new entry</div>
                </td></tr>
              ) : paged.map((h, index) => (
                <tr key={h.id}>
                  <td style={{ textAlign: 'center', color: '#94a3b8' }}>{(page - 1) * PAGE_SIZE + index + 1}</td>
                  {!hiddenCols.includes('acct')       && <td style={{ fontSize: 11, color: '#64748b' }}>{h.acctType}</td>}
                  {!hiddenCols.includes('bpNo')       && <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{h.bpNo || '—'}</td>}
                  {!hiddenCols.includes('appNo')      && <td style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600, color: '#1f4e1a' }}>{h.appNo || '—'}</td>}
                  {!hiddenCols.includes('name')       && <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{h.name}</td>}
                  {!hiddenCols.includes('mobile')     && <td style={{ whiteSpace: 'nowrap' }}>{h.mobile}</td>}
                  {!hiddenCols.includes('houseNo')    && <td style={{ whiteSpace: 'nowrap' }}>{h.houseNo}{h.floor && h.floor !== 'GF' ? <span style={{ fontSize: 10, color: '#2d6a27', marginLeft: 4, fontWeight: 600 }}>{h.floor}</span> : null}</td>}
                  {!hiddenCols.includes('floor')      && <td style={{ fontSize: 11, color: '#64748b' }}>{h.floor ? (FLOOR_LABELS_MAP[h.floor] || h.floor) : 'GF'}</td>}
                  {!hiddenCols.includes('area')       && <td>{h.area}</td>}
                  {!hiddenCols.includes('city')       && <td>{h.city}</td>}
                  {!hiddenCols.includes('meterNo')    && <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{h.meterNo || '—'}</td>}
                  {!hiddenCols.includes('meterDate')  && <td style={{ whiteSpace: 'nowrap' }}>{formatDate(h.meterDate)}</td>}
                  {!hiddenCols.includes('gcStatus')   && <td><StatusBadge val={h.gcStatus} /></td>}
                  {!hiddenCols.includes('giStatus')   && <td><StatusBadge val={h.giStatus} /></td>}
                  {!hiddenCols.includes('rfc')        && <td><StatusBadge val={h.rfc} /></td>}
                  {!hiddenCols.includes('ngStatus')   && <td><StatusBadge val={h.ngStatus} /></td>}
                  {!hiddenCols.includes('gcDate')     && <td style={{ whiteSpace: 'nowrap', fontSize: 11 }}>{h.gcDate ? new Date(h.gcDate).toLocaleDateString('en-GB') : '—'}</td>}
                  {customCols.filter(c => !hiddenCols.includes(c.key)).map(col => <td key={col.key} style={{ whiteSpace: 'nowrap' }}>{h.customFields?.[col.key] ?? h[col.key] ?? '—'}</td>)}
                  <td style={{ textAlign: 'center' }}>
                    {(() => {
                      const photos = [
                        { url: h.photo1Data, label: 'Photo 1 — Meter' },
                        { url: h.photo2Data, label: 'Photo 2 — Site' },
                      ].filter(p => p.url);
                      if (photos.length === 0) {
                        return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: '#f1f5f9', color: '#94a3b8' }}>None</span>;
                      }
                      return (
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                          {photos.map((p, i) => (
                            <PhotoViewer key={i} photoUrl={p.url} label={p.label} />
                          ))}
                        </div>
                      );
                    })()}
                  </td>

                  {canWrite && (
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={e => { e.stopPropagation(); openEditPanel(h); }}
                        title="Edit entry"
                        style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 4, width: 28, height: 28, cursor: 'pointer', fontSize: 13, color: '#374151', display:'inline-flex', alignItems:'center', justifyContent:'center' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#f0f7ee'; e.currentTarget.style.borderColor = '#2d6a27'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = '#d1d5db'; }}
                      >✏</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '12px 16px', borderTop: '1px solid #e5e7eb' }}>
            <button className="page-btn" onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}>←</button>
            {Array.from({ length: totalPages }, (_, i) => i+1).map(p => (
              <button key={p} className={`page-btn${p===page?' active':''}`} onClick={() => setPage(p)}>{p}</button>
            ))}
            <button className="page-btn" onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages}>→</button>
          </div>
        )}
      </div>

      {/* MeterModal removed — meter info captured in Section 4 of the Add/Edit panel */}

      {/* Add / Edit Entry Panel */}
      <SlidePanel
        isOpen={panelOpen}
        onClose={() => { setPanelOpen(false); setEditEntry(null); setErrors({}); }}
        title={panelTitle}
        onSave={handleSave}
        saveLabel={editEntry ? 'Update Entry' : 'Save Entry'}
        extraFooter={editEntry && (
          <button
            onClick={() => setShowDelete(true)}
            style={{ height:32, background:'#fee2e2', color:'#b91c1c', border:'1px solid #fca5a5', borderRadius:5, padding:'0 14px', fontSize:12, fontWeight:600, cursor:'pointer' }}
          >
            🗑 Delete Entry
          </button>
        )}
      >
        {FormBody()}

        {customCols.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <SectionTitle>6. Additional Information</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {customCols.map(col => (
                <Field key={col.key} label={col.label}>
                  {/* ROOT CAUSE FIX: SlidePanel Input passes raw string to onChange (not event).
                      Must use `val =>` not `e => e.target.value`. */}
                  <Input value={form[col.key] || ''} onChange={val => f(col.key, val)} />
                </Field>
              ))}
            </div>
          </div>
        )}
      </SlidePanel>

      {showDelete && (
        <ConfirmDelete
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
        />
      )}

      {/* ── Column Manager Modal ── */}
      {showColManager && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:9000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={() => setShowColManager(false)}>
          <div style={{ background:'#fff', borderRadius:12, padding:28, maxWidth:420, width:'100%', boxShadow:'0 20px 60px rgba(0,0,0,0.25)', maxHeight:'85vh', overflowY:'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
              <h3 style={{ margin:0, fontSize:16, fontWeight:700, color:'#1f4e1a' }}>⚙ Manage Columns</h3>
              <button onClick={() => setShowColManager(false)}
                style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#64748b', lineHeight:1 }}>×</button>
            </div>
            <p style={{ fontSize:12, color:'#64748b', marginBottom:14 }}>Toggle columns on/off. Hidden columns are saved for your session.</p>

            <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>Built-in Columns</div>
            <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:16 }}>
              {DEFAULT_COLS.map(col => (
                <label key={col.key} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:6, background: hiddenCols.includes(col.key) ? '#f8fafc' : '#f0f7ee', cursor:'pointer', border:'1px solid', borderColor: hiddenCols.includes(col.key) ? '#e2e8f0' : '#bbf7d0' }}>
                  <input type="checkbox" checked={!hiddenCols.includes(col.key)}
                    onChange={() => toggleColVisibility(col.key)}
                    style={{ accentColor:'#2d6a27', width:15, height:15 }} />
                  <span style={{ fontSize:13, fontWeight:500, color: hiddenCols.includes(col.key) ? '#94a3b8' : '#1f4e1a', flex:1 }}>{col.label}</span>
                  {hiddenCols.includes(col.key) && <span style={{ fontSize:10, color:'#94a3b8', background:'#f1f5f9', padding:'1px 6px', borderRadius:4 }}>hidden</span>}
                </label>
              ))}
            </div>

            {customCols.length > 0 && (
              <>
                <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>Custom Columns</div>
                <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:16 }}>
                  {customCols.map(col => (
                    <div key={col.key} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:6, background: hiddenCols.includes(col.key) ? '#f8fafc' : '#fefce8', border:'1px solid', borderColor: hiddenCols.includes(col.key) ? '#e2e8f0' : '#fde68a' }}>
                      <input type="checkbox" checked={!hiddenCols.includes(col.key)}
                        onChange={() => toggleColVisibility(col.key)}
                        style={{ accentColor:'#2d6a27', width:15, height:15 }} />
                      <span style={{ fontSize:13, fontWeight:500, color: hiddenCols.includes(col.key) ? '#94a3b8' : '#92400e', flex:1 }}>{col.label}</span>
                      <button onClick={() => {
                        const updated = customCols.filter(c => c.key !== col.key);
                        setCustomCols(updated);
                        saveColConfig(updated, hiddenCols);
                        setHiddenCols(prev => prev.filter(k => k !== col.key));
                        showToast(`Column "${col.label}" deleted`);
                      }} title="Delete this column permanently"
                        style={{ background:'#fee2e2', color:'#dc2626', border:'none', borderRadius:4, width:26, height:26, cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>×</button>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div style={{ borderTop:'1px solid #f1f5f9', paddingTop:14 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>Add New Column</div>
              <div style={{ display:'flex', gap:8 }}>
                <input
                  placeholder="Column name..."
                  value={newColNameHT}
                  onChange={e => setNewColNameHT(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') e.currentTarget.nextElementSibling?.click();
                  }}
                  style={{ flex:1, height:34, border:'1px solid #d1d5db', borderRadius:6, padding:'0 10px', fontSize:13 }} />
                <button onClick={() => {
                  const val = newColNameHT.trim();
                  if (!val) return;
                  const newCol = { key: 'custom_' + Date.now(), label: val };
                  const updated = [...customCols, newCol];
                  setCustomCols(updated);
                  saveColConfig(updated, hiddenCols);
                  setNewColNameHT('');
                  showToast(`✓ Column "${val}" added`);
                }} style={{ height:34, background:'#2d6a27', color:'#fff', border:'none', borderRadius:6, padding:'0 14px', fontSize:13, fontWeight:600, cursor:'pointer' }}>+ Add</button>
              </div>
            </div>

            <button onClick={() => { setHiddenCols([]); saveColConfig(customCols, []); showToast('All columns visible'); }}
              style={{ marginTop:14, width:'100%', height:32, background:'#f1f5f9', color:'#374151', border:'1px solid #e2e8f0', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer' }}>
              ↺ Reset — Show All Columns
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Legacy label map — kept for backward compat but no longer used for the site pill
const SITE_OPTIONS_LABELS = {};
// eslint-disable-next-line no-unused-vars
void SITE_OPTIONS_LABELS;
