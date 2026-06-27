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

/* ══════════════════════════════════════
   1. Export House Connections
   ══════════════════════════════════════ */
export function exportHouseData(houses, fromDate, toDate, filterLabel, filenameSuffix) {
  const data = filterByDateRange(houses, fromDate, toDate, 'meterDate', 'createdAt');

  const headers = [
    'Acct Type','BP No.','Customer Name','Mobile','House No.','Area','City',
    'Meter No.','Meter Date','GC Status','GI Status','RFC','NG Status','SARAL Status','Photo Uploaded',
  ];

  const rows = data.map(h => [
    h.acctType, h.bpNo, h.name, h.mobile, h.houseNo, h.area, h.city,
    h.meterNo, h.meterDate, h.gcStatus, h.giStatus, h.rfc, h.ngStatus, h.saralStatus,
    h.meterPhoto ? 'Yes' : 'No',
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [
    { wch: 10 },{ wch: 16 },{ wch: 20 },{ wch: 14 },{ wch: 14 },
    { wch: 10 },{ wch: 10 },{ wch: 16 },{ wch: 12 },
    { wch: 12 },{ wch: 10 },{ wch: 8  },{ wch: 12 },{ wch: 16 },{ wch: 12 },
  ];

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

  const headers = [[
    'Sr.','Laying Date','Testing Date','Charging Date','RA Bill No.','Report No.','Work Status','Area',
    'Coil No.','Ø32mm OC','Ø32mm Boring','Ø32mm Total','Ø63mm OC','Ø63mm Boring','Ø63mm HDD','Ø63mm Total','Ø90mm Total','Ø125mm Total',
  ]];

  const rows = filteredData.map(r => [
    r.sr, r.layDate, r.testDate, r.chargeDate, r.raBill, r.reportNo, r.status, r.area, r.coil,
    r.d32oc, r.d32b, r.d32oc + r.d32b,
    r.d63oc, r.d63b, r.d63hdd, r.d63oc + r.d63b + r.d63hdd,
    r.d90tot, r.d125tot,
  ]);

  const tot = filteredData.reduce((acc, r) => ({
    d32oc: acc.d32oc + r.d32oc, d32b: acc.d32b + r.d32b,
    d63oc: acc.d63oc + r.d63oc, d63b: acc.d63b + r.d63b,
    d63h:  acc.d63h  + r.d63hdd, d90: acc.d90  + r.d90tot, d125: acc.d125 + r.d125tot,
  }), { d32oc:0,d32b:0,d63oc:0,d63b:0,d63h:0,d90:0,d125:0 });

  const totalRow = [
    '','','','','','','','TOTAL','',
    tot.d32oc, tot.d32b, tot.d32oc+tot.d32b,
    tot.d63oc, tot.d63b, tot.d63h, tot.d63oc+tot.d63b+tot.d63h,
    tot.d90, tot.d125,
  ];

  const ws = XLSX.utils.aoa_to_sheet([...headers, ...rows, totalRow]);
  ws['!cols'] = [
    { wch:5 },{ wch:12 },{ wch:12 },{ wch:14 },{ wch:14 },
    { wch:10 },{ wch:10 },{ wch:20 },{ wch:18 },
    { wch:10 },{ wch:12 },{ wch:12 },
    { wch:10 },{ wch:12 },{ wch:10 },{ wch:12 },{ wch:12 },{ wch:12 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'PE Laying Data');
  const filename = (fromDate && toDate)
    ? `GP_PMS_PELaying_${fromDate}_to_${toDate}.xlsx`
    : `GP_PMS_PELaying_${today()}.xlsx`;
  download(wb, filename);
}
