// src/utils/exportExcel.js
import * as XLSX from 'xlsx';

function today() {
  return new Date().toISOString().split('T')[0];
}

function download(wb, filename) {
  XLSX.writeFile(wb, filename);
}

/* ── Helper: styled header row ── */
function applyHeaderStyle(ws, headerRow, cols) {
  // XLSX community edition doesn't support cell styles directly,
  // so we manually set the header row values and column widths.
  XLSX.utils.sheet_add_aoa(ws, [headerRow], { origin: 'A1' });
  ws['!cols'] = cols.map(w => ({ wch: w }));
}

/* ══════════════════════════════════════
   1. Export House Connections
   ══════════════════════════════════════ */
function parseEntryDate(dateStr) {
  if (!dateStr || dateStr === '-' || dateStr === '—') return null;
  if (dateStr.includes('-') && dateStr.split('-')[0].length === 4) {
    return dateStr;
  }
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
      return `${year}-${month}-${day}`;
    }
  }
  return null;
}

export function exportHouseData(houses, fromDate, toDate) {
  const headers = [
    'Acct Type','BP No.','Customer Name','Mobile','House No.','Area','City',
    'Meter No.','Meter Date','GC Status','GI Status','RFC','NG Status','SARAL Status','Photo Uploaded',
  ];

  let filteredHouses = houses;
  if (fromDate || toDate) {
    filteredHouses = houses.filter(h => {
      const entryDate = h.entryDate || parseEntryDate(h.meterDate);
      if (!entryDate) return false;
      if (fromDate && entryDate < fromDate) return false;
      if (toDate && entryDate > toDate) return false;
      return true;
    });
  }

  const rows = filteredHouses.map(h => [
    h.acctType, h.bpNo, h.name, h.mobile, h.houseNo, h.area, h.city,
    h.meterNo, h.meterDate, h.gcStatus, h.giStatus, h.rfc, h.ngStatus, h.saralStatus,
    h.meterPhoto ? 'Yes' : 'No',
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  ws['!cols'] = [
    { wch: 10 }, // Acct Type
    { wch: 16 }, // BP No
    { wch: 20 }, // Name
    { wch: 14 }, // Mobile
    { wch: 14 }, // House No
    { wch: 10 }, // Area
    { wch: 10 }, // City
    { wch: 16 }, // Meter No
    { wch: 12 }, // Meter Date
    { wch: 12 }, // GC Status
    { wch: 10 }, // GI Status
    { wch: 8  }, // RFC
    { wch: 12 }, // NG Status
    { wch: 16 }, // SARAL Status
    { wch: 12 }, // Photo
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'House Connections');

  const filename = (fromDate && toDate)
    ? `GP_PMS_HouseData_${fromDate}_to_${toDate}.xlsx`
    : `GP_PMS_HouseData_${today()}.xlsx`;

  download(wb, filename);
}

/* ══════════════════════════════════════
   2. Export Stock Statement
   ══════════════════════════════════════ */
export function exportStockData(stock) {
  const title   = [['OXYGEN PROTECH PVT LTD — Stock Statement']];
  const headers = [['Sr.','Material','Unit','Opening Stock','Received Qty','Issued Qty','Return Qty','Net Used','Physical On Site','Physical In Store','Required','Status']];

  const rows = stock.map((s, i) => {
    const netUsed = (s.issued ?? s.issued) - (s.ret ?? s.returned ?? 0);
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

  // Merge title across all 12 columns: A1:L1
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 11 } }];

  ws['!cols'] = [
    { wch: 5  }, // Sr
    { wch: 25 }, // Material
    { wch: 7  }, // Unit
    { wch: 10 }, // Opening
    { wch: 10 }, // Received
    { wch: 10 }, // Issued
    { wch: 10 }, // Returned
    { wch: 10 }, // Net Used
    { wch: 10 }, // On Site
    { wch: 10 }, // In Store
    { wch: 10 }, // Required
    { wch: 10 }, // Status
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Stock Statement');
  download(wb, `GP_PMS_Stock_${today()}.xlsx`);
}

/* ══════════════════════════════════════
   3. Export PE Laying Data
   ══════════════════════════════════════ */
export function exportPELaying(data) {
  const headers = [[
    'Sr.','Laying Date','Testing Date','Charging Date','RA Bill No.','Report No.','Work Status','Area',
    'Coil No.','Ø32mm OC','Ø32mm Boring','Ø32mm Total','Ø63mm OC','Ø63mm Boring','Ø63mm HDD','Ø63mm Total','Ø90mm Total','Ø125mm Total',
  ]];

  const rows = data.map(r => [
    r.sr, r.layDate, r.testDate, r.chargeDate, r.raBill, r.reportNo, r.status, r.area, r.coil,
    r.d32oc, r.d32b, r.d32oc + r.d32b,
    r.d63oc, r.d63b, r.d63hdd, r.d63oc + r.d63b + r.d63hdd,
    r.d90tot, r.d125tot,
  ]);

  /* Totals row */
  const tot = data.reduce((acc, r) => ({
    d32oc: acc.d32oc + r.d32oc,
    d32b:  acc.d32b  + r.d32b,
    d63oc: acc.d63oc + r.d63oc,
    d63b:  acc.d63b  + r.d63b,
    d63h:  acc.d63h  + r.d63hdd,
    d90:   acc.d90   + r.d90tot,
    d125:  acc.d125  + r.d125tot,
  }), { d32oc:0,d32b:0,d63oc:0,d63b:0,d63h:0,d90:0,d125:0 });

  const totalRow = [
    '','','','','','','','TOTAL','',
    tot.d32oc, tot.d32b, tot.d32oc+tot.d32b,
    tot.d63oc, tot.d63b, tot.d63h, tot.d63oc+tot.d63b+tot.d63h,
    tot.d90, tot.d125,
  ];

  const ws = XLSX.utils.aoa_to_sheet([...headers, ...rows, totalRow]);

  ws['!cols'] = [
    { wch: 5  },{ wch: 12 },{ wch: 12 },{ wch: 14 },{ wch: 14 },
    { wch: 10 },{ wch: 10 },{ wch: 20 },{ wch: 18 },
    { wch: 10 },{ wch: 12 },{ wch: 12 },
    { wch: 10 },{ wch: 12 },{ wch: 10 },{ wch: 12 },
    { wch: 12 },{ wch: 12 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'PE Laying Data');
  download(wb, `GP_PMS_PELaying_${today()}.xlsx`);
}

export function exportLMCData(data) {
  const headers = [['Sr.','Application No.','BP No.','Customer Name','Address','LMC Date','Regulator No.','Meter Serial No.','Remarks']];
  const rows = data.map((r, i) => [
    i + 1,
    r.appNo || '—',
    r.bpNo || '—',
    r.customerName || '—',
    r.address || '—',
    r.lmcDate ? r.lmcDate.split('T')[0] : '—',
    r.regulatorNo || '—',
    r.meterSerialNo || '—',
    r.remarks || 'PENDING',
  ]);
  const ws = XLSX.utils.aoa_to_sheet([...headers, ...rows]);
  ws['!cols'] = [
    { wch: 5 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 25 },
    { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 12 }
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'LMC Work');
  download(wb, `GP_PMS_LMC_${today()}.xlsx`);
}

export function exportICData(data) {
  const headers = [['Sr.','Customer Name','Address','I&C Date','Regulator No.','Meter Serial No.','Pressure (mbar)','Flow Rate (SCMH)','Status']];
  const rows = data.map((r, i) => [
    i + 1,
    r.customerName || '—',
    r.address || '—',
    r.icDate ? r.icDate.split('T')[0] : '—',
    r.regulatorNo || '—',
    r.meterSerialNo || '—',
    r.regulatorPoutMbar || 0,
    r.flowRateScmh || 0,
    r.status || 'Pending',
  ]);
  const ws = XLSX.utils.aoa_to_sheet([...headers, ...rows]);
  ws['!cols'] = [
    { wch: 5 }, { wch: 20 }, { wch: 25 }, { wch: 12 }, { wch: 15 },
    { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'I&C Work');
  download(wb, `GP_PMS_IC_${today()}.xlsx`);
}
