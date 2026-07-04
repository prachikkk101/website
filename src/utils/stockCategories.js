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
    '½" FIM (Female Iron Mouth)',
    '¾" FIM',
    '1" FIM',
    'Regulator — Single Stage',
    'Regulator — Two Stage',
    'Meter — G1.6',
    'Meter — G2.5',
    'Gas Cock ½"',
    'Gas Cock ¾"',
  ],
  'GI Fitting — ½ inch': [
    '½" GI Pipe (per mtr)',
    '½" Elbow 90°',
    '½" Tee',
    '½" Union',
    '½" Nipple',
    '½" Reducer Bush',
    '½" End Cap',
    '½" Socket',
  ],
  'GI Fitting — ¾ inch': [
    '¾" GI Pipe (per mtr)',
    '¾" Elbow 90°',
    '¾" Tee',
    '¾" Union',
    '¾" Nipple',
    '¾" Reducer Bush',
    '¾" End Cap',
    '¾" Socket',
  ],
  'GI Fitting — 1 inch': [
    '1" GI Pipe (per mtr)',
    '1" Elbow 90°',
    '1" Tee',
    '1" Union',
    '1" Nipple',
    '1" End Cap',
    '1" Socket',
  ],
  'MDPE Fittings': [
    'MDPE Pipe 20mm (per mtr)',
    'MDPE Pipe 25mm (per mtr)',
    'MDPE Pipe 32mm (per mtr)',
    'MDPE Coupler 20mm',
    'MDPE Coupler 25mm',
    'MDPE Elbow 20mm',
    'MDPE Tee 20mm',
    'MDPE End Cap',
    'MDPE Saddle Clamp',
  ],
  'MLC Fittings': [
    'MLC Pipe ½" (per mtr)',
    'MLC Pipe ¾" (per mtr)',
    'MLC Connector ½"',
    'MLC Connector ¾"',
    'MLC Elbow ½"',
    'MLC Elbow ¾"',
    'MLC Tee ½"',
    'MLC Tee ¾"',
    'MLC End Cap',
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

  return cats.map((c, i) => {
    const defaultItems = DEFAULT_MATERIALS_BY_CATEGORY[c.name] || [];

    let items;
    if (stockItems !== null) {
      // Return mode: only show materials actually in this site's inventory
      const siteMatNames = stockItems.map(s => s.mat || s.material).filter(Boolean);
      const knownInCat = defaultItems.filter(m => siteMatNames.includes(m));
      // Orphan items (custom materials not in any category) go into the last category
      const orphans = siteMatNames.filter(m => !allDefaultItems.includes(m));
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
