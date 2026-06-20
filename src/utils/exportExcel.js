// src/utils/exportExcel.js
import * as XLSX from 'xlsx';

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function downloadWorkbook(wb, filename) {
  XLSX.writeFile(wb, filename);
}

export function exportHouseData(houses) {
  const rows = houses.map(h => ({
    'Acct Type': h.acctType,
    'BP No.': h.bpNo,
    'Customer Name': h.name,
    'Mobile': h.mobile,
    'House No.': h.houseNo,
    'Area': h.area,
    'City': h.city,
    'Meter No.': h.meterNo,
    'Meter Date': h.meterDate,
    'GC Status': h.gcStatus,
    'GI Status': h.giStatus,
    'RFC': h.rfc,
    'NG Status': h.ngStatus,
    'SARAL Status': h.saralStatus,
    'Photo Uploaded': h.meterPhoto ? 'Yes' : 'No',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  ws['!cols'] = [
    { wch: 12 }, // Acct Type
    { wch: 14 }, // BP No.
    { wch: 22 }, // Customer Name
    { wch: 14 }, // Mobile
    { wch: 18 }, // House No.
    { wch: 12 }, // Area
    { wch: 12 }, // City
    { wch: 16 }, // Meter No.
    { wch: 12 }, // Meter Date
    { wch: 14 }, // GC Status
    { wch: 12 }, // GI Status
    { wch: 10 }, // RFC
    { wch: 12 }, // NG Status
    { wch: 16 }, // SARAL Status
    { wch: 16 }, // Photo Uploaded
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'House Connections');
  downloadWorkbook(wb, `GP_PMS_HouseData_${getToday()}.xlsx`);
}

export function exportStockData(stock) {
  const rows = stock.map((s, i) => {
    const netUsed = s.issued - s.returned;
    return {
      'Sr.': i + 1,
      'Material': s.material,
      'Unit': s.unit,
      'Opening Stock': s.opening,
      'Received Qty': s.received,
      'Issued Qty': s.issued,
      'Return Qty': s.returned,
      'Net Used': netUsed,
      'Physical On Site': s.physical_site,
      'Physical In Store': s.physical_store,
      'Required': s.required,
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);

  ws['!cols'] = [
    { wch: 6 },  // Sr.
    { wch: 28 }, // Material
    { wch: 8 },  // Unit
    { wch: 16 }, // Opening Stock
    { wch: 14 }, // Received Qty
    { wch: 12 }, // Issued Qty
    { wch: 12 }, // Return Qty
    { wch: 12 }, // Net Used
    { wch: 18 }, // Physical On Site
    { wch: 18 }, // Physical In Store
    { wch: 12 }, // Required
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Stock Statement');
  downloadWorkbook(wb, `GP_PMS_Stock_${getToday()}.xlsx`);
}
