// src/utils/exportExcel.js
import * as XLSX from 'xlsx';

function today() {
  return new Date().toISOString().split('T')[0];
}

function download(wb, filename) {
  XLSX.writeFile(wb, filename);
}

/* Parse a date string or Date object safely */
function parseDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

/* Filter array by date range using multiple possible date field names */
function filterByDateRange(data, fromDate, toDate, ...fields) {
  if (!fromDate && !toDate) return data;
  const from = fromDate ? new Date(fromDate + 'T00:00:00') : null;
  const to   = toDate   ? new Date(toDate   + 'T23:59:59') : null;
  return data.filter(r => {
    for (const f of fields) {
      const d = parseDate(r[f]);
      if (!d) continue;
      if (from && d < from) return false;
      if (to   && d > to)   return false;
      return true;
    }
    return true; // no date field → include
  });
}

/* Helper to parse materialsUsed / mdpeMaterials into a clean JS Map<materialName, { qty, unit }> */
function parseMaterialsToMap(mats) {
  const map = new Map();
  if (!mats) return map;

  if (Array.isArray(mats)) {
    for (const item of mats) {
      if (!item) continue;
      const name = typeof item === 'string' ? item : item.material;
      const qty = typeof item === 'object' ? (Number(item.qty) || 0) : 1;
      const unit = typeof item === 'object' ? (item.unit || '') : '';
      if (name && String(name).trim()) {
        const key = String(name).trim();
        const existing = map.get(key) || { qty: 0, unit: '' };
        map.set(key, { qty: existing.qty + qty, unit: unit || existing.unit });
      }
    }
  } else if (typeof mats === 'object') {
    for (const [k, v] of Object.entries(mats)) {
      if (!k || !String(k).trim()) continue;
      const key = String(k).trim();
      const qty = typeof v === 'object' ? (Number(v.qty) || 0) : (Number(v) || 0);
      const unit = typeof v === 'object' ? (v.unit || '') : '';
      const existing = map.get(key) || { qty: 0, unit: '' };
      map.set(key, { qty: existing.qty + qty, unit: unit || existing.unit });
    }
  }
  return map;
}

/* Collect all unique material names across all data rows */
function getUniqueMaterialsList(dataList, matsField) {
  const materialsMap = new Map(); // name -> predominant unit
  for (const row of dataList) {
    const rowMap = parseMaterialsToMap(row[matsField] || row.materialsUsed || row.materials);
    for (const [matName, info] of rowMap.entries()) {
      if (info.qty > 0) {
        if (!materialsMap.has(matName)) {
          materialsMap.set(matName, info.unit || 'pcs');
        } else if (info.unit && materialsMap.get(matName) === 'pcs') {
          materialsMap.set(matName, info.unit);
        }
      }
    }
  }
  return Array.from(materialsMap.entries()).map(([name, unit]) => ({ name, unit }));
}

/* ══════════════════════════════════════
   1. Export House Connections
   ══════════════════════════════════════ */
export function exportHouseData(houses, fromDate, toDate, filterLabel, filenameSuffix) {
  const data = filterByDateRange(houses, fromDate, toDate, 'meterDate', 'createdAt');

  const baseHeaders = [
    'Acct Type','BP No.','Customer Name','Mobile','House No.','Area','City',
    'Meter No.','Meter Date','GC Status','GI Status','RFC','NG Status','SARAL Status','Photo Uploaded',
  ];

  // Dynamically collect all unique materials used in this exported set
  const uniqueMaterials = getUniqueMaterialsList(data, 'materialsUsed');
  const matHeaders = uniqueMaterials.map(m => m.unit ? `${m.name} (${m.unit})` : m.name);
  const headers = [...baseHeaders, ...matHeaders];

  const rows = data.map(h => {
    const baseRow = [
      h.acct        || h.acctType    || h.accountType  || '',
      h.bp          || h.bpNo        || h.bpNumber      || '',
      h.name        || h.customerName || '',
      h.mobile      || h.mobileNo    || '',
      h.house       || h.houseNo     || h.houseNumber   || '',
      h.area        || '',
      h.city        || '',
      h.meter       || h.meterNo     || h.meterNumber   || '',
      h.meterDate   || h.mdate       || '',
      h.gc          || h.gcStatus    || '',
      h.gi          || h.giStatus    || '',
      h.rfc         || h.rfcStatus   || '',
      h.ng          || h.ngStatus    || '',
      h.saral       || h.saralStatus || '',
      (h.meterPhoto || h.photo || h.photo1Data || h.photo2Data) ? 'Yes' : 'No',
    ];

    const houseMatMap = parseMaterialsToMap(h.materialsUsed || h.materials);
    const matQtyValues = uniqueMaterials.map(m => {
      const entry = houseMatMap.get(m.name);
      return entry && entry.qty > 0 ? entry.qty : 0;
    });

    return [...baseRow, ...matQtyValues];
  });

  // Calculate TOTAL consumption row at bottom if materials exist
  if (data.length > 0 && uniqueMaterials.length > 0) {
    const totalRow = new Array(baseHeaders.length).fill('');
    totalRow[0] = 'TOTAL CONSUMPTION';
    for (let i = 0; i < uniqueMaterials.length; i++) {
      const matName = uniqueMaterials[i].name;
      const sum = data.reduce((acc, h) => {
        const houseMatMap = parseMaterialsToMap(h.materialsUsed || h.materials);
        const entry = houseMatMap.get(matName);
        return acc + (entry && entry.qty > 0 ? entry.qty : 0);
      }, 0);
      totalRow.push(Math.round(sum * 100) / 100);
    }
    rows.push(totalRow);
  }

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const baseCols = [
    { wch: 10 },{ wch: 16 },{ wch: 20 },{ wch: 14 },{ wch: 14 },
    { wch: 10 },{ wch: 10 },{ wch: 16 },{ wch: 12 },
    { wch: 12 },{ wch: 10 },{ wch: 8  },{ wch: 12 },{ wch: 16 },{ wch: 12 },
  ];
  const matCols = uniqueMaterials.map(() => ({ wch: 18 }));
  ws['!cols'] = [...baseCols, ...matCols];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'House Connections');

  let filename;
  if (filenameSuffix) {
    filename = `GP_PMS_Houses_${filenameSuffix}.xlsx`;
  } else if (fromDate && toDate) {
    filename = `GP_PMS_HouseData_${fromDate}_to_${toDate}.xlsx`;
  } else {
    filename = `GP_PMS_HouseData_${today()}.xlsx`;
  }
  download(wb, filename);
}

/* ══════════════════════════════════════
   2. Export Stock Statement
   ══════════════════════════════════════ */
export function exportStockData(stock, fromDate, toDate) {
  const title   = [['OXYGEN PROTECH PVT LTD — Stock Statement']];
  const headers = [['Sr.','Material','Unit','Opening Stock','Received Qty','Issued Qty','Return Qty','Net Used','Physical On Site','Physical In Store','Required','Status']];

  const rows = stock.map((s, i) => {
    const netUsed = (s.issued ?? 0) - (s.ret ?? s.returned ?? 0);
    const status  = s.status?.label ?? s.status ?? '';
    return [
      i + 1,
      s.mat ?? s.material,
      s.unit,
      s.open ?? s.opening,
      s.recv ?? s.received,
      s.issued,
      s.ret ?? s.returned,
      netUsed,
      s.onSite ?? s.physical_site,
      s.inStore ?? s.physical_store,
      s.req ?? s.required,
      status,
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([...title, ...headers, ...rows]);
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 11 } }];
  ws['!cols'] = [
    { wch: 5  },{ wch: 25 },{ wch: 7  },{ wch: 10 },{ wch: 10 },
    { wch: 10 },{ wch: 10 },{ wch: 10 },{ wch: 10 },{ wch: 10 },{ wch: 10 },{ wch: 10 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Stock Statement');
  const filename = fromDate
    ? `GP_PMS_Stock_${fromDate}.xlsx`
    : `GP_PMS_Stock_${today()}.xlsx`;
  download(wb, filename);
}

/* ══════════════════════════════════════
   3. Export PE Laying Data
   ══════════════════════════════════════ */
export function exportPELaying(data, fromDate, toDate) {
  const filteredData = filterByDateRange(data, fromDate, toDate, 'layDate', 'layingDate');

  const baseHeaders = [
    'Sr.','Laying Date','Testing Date','Charging Date','RA Bill No.','Report No.','Work Status','Area',
    'Coil No.','Ø32mm OC','Ø32mm Boring','Ø32mm Total','Ø63mm OC','Ø63mm Boring','Ø63mm HDD','Ø63mm Total','Ø90mm Total','Ø125mm Total',
  ];

  const uniqueMaterials = getUniqueMaterialsList(filteredData, 'mdpeMaterials');
  const matHeaders = uniqueMaterials.map(m => m.unit ? `${m.name} (${m.unit})` : m.name);
  const headers = [...baseHeaders, ...matHeaders];

  const rows = filteredData.map(r => {
    const baseRow = [
      r.sr, r.layDate, r.testDate, r.chargeDate, r.raBill, r.reportNo, r.status, r.area, r.coil,
      r.d32oc, r.d32b, (r.d32oc || 0) + (r.d32b || 0),
      r.d63oc, r.d63b, r.d63hdd, (r.d63oc || 0) + (r.d63b || 0) + (r.d63hdd || 0),
      r.d90tot, r.d125tot,
    ];

    const rowMatMap = parseMaterialsToMap(r.mdpeMaterials || r.materialsUsed);
    const matQtyValues = uniqueMaterials.map(m => {
      const entry = rowMatMap.get(m.name);
      return entry && entry.qty > 0 ? entry.qty : 0;
    });

    return [...baseRow, ...matQtyValues];
  });

  const tot = filteredData.reduce((acc, r) => ({
    d32oc: acc.d32oc + (r.d32oc || 0), d32b: acc.d32b + (r.d32b || 0),
    d63oc: acc.d63oc + (r.d63oc || 0), d63b: acc.d63b + (r.d63b || 0),
    d63h:  acc.d63h  + (r.d63hdd || 0), d90: acc.d90  + (r.d90tot || 0), d125: acc.d125 + (r.d125tot || 0),
  }), { d32oc:0,d32b:0,d63oc:0,d63b:0,d63h:0,d90:0,d125:0 });

  const totalRow = [
    'TOTAL', '', '', '', '', '', '', '', '',
    tot.d32oc, tot.d32b, tot.d32oc + tot.d32b,
    tot.d63oc, tot.d63b, tot.d63h, tot.d63oc + tot.d63b + tot.d63h,
    tot.d90, tot.d125,
  ];

  for (let i = 0; i < uniqueMaterials.length; i++) {
    const matName = uniqueMaterials[i].name;
    const sum = filteredData.reduce((acc, r) => {
      const rowMatMap = parseMaterialsToMap(r.mdpeMaterials || r.materialsUsed);
      const entry = rowMatMap.get(matName);
      return acc + (entry && entry.qty > 0 ? entry.qty : 0);
    }, 0);
    totalRow.push(Math.round(sum * 100) / 100);
  }

  rows.push(totalRow);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const baseCols = [
    { wch: 5 },{ wch: 12 },{ wch: 12 },{ wch: 12 },{ wch: 12 },{ wch: 12 },{ wch: 14 },{ wch: 14 },
    { wch: 12 },{ wch: 10 },{ wch: 10 },{ wch: 10 },{ wch: 10 },{ wch: 10 },{ wch: 10 },{ wch: 10 },
    { wch: 10 },{ wch: 10 },
  ];
  const matCols = uniqueMaterials.map(() => ({ wch: 18 }));
  ws['!cols'] = [...baseCols, ...matCols];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'PE Laying Progress');
  const filename = fromDate
    ? `GP_PMS_PELaying_${fromDate}.xlsx`
    : `GP_PMS_PELaying_${today()}.xlsx`;
  download(wb, filename);
}
