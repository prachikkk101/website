/**
 * stockCategories.js
 * Shared default material lists per stock category.
 * Used by Inventory.jsx and HouseTable.jsx to populate
 * the category accordion with GAIL standard material names.
 *
 * These are UI-level defaults — the actual inventory records
 * come from the backend (InventoryItem table in Neon DB).
 */

/** Default material names per category */
export const DEFAULT_MATERIALS_BY_CATEGORY = {
  'FIM Material': [
    '32mm PE Pipe',
    '63mm PE Pipe',
    '90mm PE Pipe',
    '125mm PE Pipe',
    '20mm PE Pipe',
    '32mm PE Valve',
    '63mm PE Valve',
    '90mm PE Valve',
    '125mm PE Valve',
    '20mm Coupler',
    '32mm Coupler',
    '63mm Coupler',
    '125mm Coupler',
    '20mm Tee',
    '32mm Tee',
    '63mm Tee',
    '125mm Tee',
    '20mm End Cap',
    '32mm End Cap',
    '63mm End Cap',
    '90mm End Cap',
    '125mm End Cap',
    '32mm Elbow',
    '63mm Elbow',
    '90mm Elbow',
    '125mm Elbow',
    '32/20 Saddle',
    '63/20 Saddle',
    '63/32 Saddle',
    '90/63 Saddle',
    '125/63 Saddle',
    '32/20 Reducer',
    '63/32 Reducer',
    '90/63 Reducer',
    '125/90 Reducer',
    '20mm T/F ½"',
    '32mm T/F 1"',
    '63mm T/F 2"',
    'Warning Mate',
    'Rubber Tube',
  ],
  'GI Fitting — ½ inch': [
    '½" GI Clamp',
    '½" GI Elbow',
    '½" GI Socket',
    '½" GI M/F Elbow',
    '½" GI Nipple 2"',
    '½" GI Nipple 3"',
    '½" GI Nipple 4"',
    '½" GI Nipple 5"',
    '½" GI Nipple 6"',
    'Meter Adaptor',
    'Teflon Tape',
    '½" GI Tee',
    '½" T/F',
    '½" T/F Fusion',
    '½" Ball Valve (IV)',
    '½" Gas Tape (AV)',
    'Rubber Tube Clamp',
    'Anti Corrosive Tape',
    'PVC Pipe 1"',
  ],
  'GI Fitting — ¾ inch': [
    '¾" GI Clamp',
    '¾" GI Elbow',
    '¾" GI Socket',
    '¾" GI M/F Elbow',
    '¾" GI Pipe',
    '¾" GI Nipple 2"',
    '¾" GI Nipple 3"',
    '¾" GI Nipple 4"',
    '¾" GI Nipple 5"',
    '¾" GI Nipple 6"',
    '¾" Ball Valve (IV)',
    '¾" GI Tee',
    '¾"/½" Tee',
  ],
  'GI Fitting — 1 inch': [
    '½" GI End Cap',
    '1" GI Pipe',
    '1" GI Clamp',
    '1" GI Elbow',
    '1" GI M/F Elbow',
    '1" GI Socket',
    '1" GI Nipple 2"',
    '1" GI Nipple 3"',
    '1" GI Nipple 4"',
    '1" GI Nipple 5"',
    '1" GI Nipple 6"',
    '1" GI Tee',
    '1"/½" GI Tee',
    '1" Ball Valve (IV)',
    '½" Union',
  ],
  'MDPE Fittings': [
    '20mm Coupler',
    '32mm Coupler',
    '63mm Coupler',
    '90mm Coupler',
    '125mm Coupler',
    '20mm Tee',
    '32mm Tee',
    '63mm Tee',
    '90mm Tee',
    '125mm Tee',
    '32mm Elbow',
    '63mm Elbow',
    '90mm Elbow',
    '125mm Elbow',
    '20mm End Cap',
    '32mm End Cap',
    '63mm End Cap',
    '90mm End Cap',
    '125mm End Cap',
    '32/20 Saddle',
    '63/20 Saddle',
    '63/32 Saddle',
    '90/63 Saddle',
    '125/63 Saddle',
    '32/20 Reducer',
    '63/32 Reducer',
    '90/63 Reducer',
    '125/90 Reducer',
    '½" T/F Fusion',
    '20mm PE Pipe',
  ],
  'MLC Fittings': [
    'MLC Pipe 12mm',
    'MLC Clamp',
    'MLC M Union',
    'MLC F Union',
    'MLC Clamp B Type',
    'MLC Reamer',
  ],
};

/** Color per category for accordion headers */
export const CAT_COLORS = {
  'FIM Material':         '#1f4e1a',
  'GI Fitting — ½ inch': '#164e63',
  'GI Fitting — ¾ inch': '#1e3a8a',
  'GI Fitting — 1 inch': '#312e81',
  'MDPE Fittings':        '#6b21a8',
  'MLC Fittings':         '#7c2d12',
};

/**
 * Build the accordion category objects from an API response.
 * @param {Array<{id: number, name: string}>} cats - from dataAPI.getStockCategories()
 * @param {Array<object>|null} stockItems - existing site InventoryItem rows for Return mode
 * @returns {Array<{id: string, label: string, color: string, items: string[]}>}
 */
export function buildAccordionCategories(cats, stockItems = null) {
  const allDefaultItems = Object.values(DEFAULT_MATERIALS_BY_CATEGORY).flat();

  // Normalize: lowercase + trim, for case/whitespace-insensitive matching
  const normalize = (s) => (s || '').toLowerCase().trim();
  const normalizedAllDefaults = allDefaultItems.map(normalize);

  return cats.map((c, i) => {
    const defaultItems = DEFAULT_MATERIALS_BY_CATEGORY[c.name] || [];

    let items;
    if (stockItems !== null) {
      // Return mode: only show materials actually in this site's inventory
      const siteMatNames = stockItems.map(s => s.mat || s.material).filter(Boolean);
      const normalizedSiteNames = siteMatNames.map(normalize);

      // Match using normalized comparison (handles trailing spaces, case diffs)
      const knownInCat = defaultItems.filter(m => normalizedSiteNames.includes(normalize(m)));

      // Orphan items (custom materials not in any default category)
      const orphans = siteMatNames.filter(m => !normalizedAllDefaults.includes(normalize(m)));
      items = i === cats.length - 1 ? [...knownInCat, ...orphans] : knownInCat;
    } else {
      items = defaultItems;
    }

    return {
      id: String(c.id),
      label: c.name,
      color: CAT_COLORS[c.name] || '#1f4e1a',
      items,
    };
  });
}
