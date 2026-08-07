/**
 * StockCategoryAccordion.jsx
 *
 * Shared "available-stock" accordion used by:
 *   - HouseTable  (PNG Connection → Materials Used)
 *   - PELaying    (PE Laying → Materials Used)
 *
 * Fetches GA-scoped stock categories internally (requires gaName).
 * Filters items to those with siteStockMap[item] > 0 when stock is loaded.
 * Shows (max: N) hint and caps number input at the available quantity.
 *
 * Props:
 *   gaName        {string}   GA Location name — required for the API call.
 *   siteStockMap  {object}   { materialName: inStoreQty } from stockAPI.getAll(siteId).
 *   catQtys       {object}   { 'catId__itemName': qty } — controlled by parent.
 *   setCatQtys    {function} Updater for catQtys.
 *   catOpen       {string|null} Currently open category id.
 *   setCatOpen    {function} Updater for catOpen.
 *   initialQtys   {object}   { itemName: qty } — pre-filled quantities for edit mode.
 *                            Items with initialQtys[item] > 0 are shown even if
 *                            siteStockMap[item] === 0 (stock already consumed by this entry).
 */

import { useState, useEffect, useMemo } from 'react';
import { dataAPI } from '../utils/api';
import { buildAccordionCategories } from '../utils/stockCategories';

export default function StockCategoryAccordion({
  gaName,
  siteStockMap = {},
  catQtys,
  setCatQtys,
  catOpen,
  setCatOpen,
  categoryFilter, // optional string or string[] e.g. "MDPE Fittings"
  initialQtys = {}, // { itemName: qty } — quantities pre-filled from an existing saved entry
}) {
  const [categories, setCategories] = useState([]);

  // Re-fetch whenever the GA Location changes.
  useEffect(() => {
    if (!gaName) {
      console.log('📋 StockCategoryAccordion: no gaName yet — clearing categories');
      setCategories([]);
      return;
    }
    console.log('🔵 StockCategoryAccordion: fetching categories for GA:', gaName);
    dataAPI.getStockCategories(gaName)
      .then(cats => {
        console.log('🟢 StockCategoryAccordion: received', cats.length, 'categories for GA:', gaName);
        setCategories(buildAccordionCategories(cats, null));
      })
      .catch(err => {
        console.error('❌ StockCategoryAccordion: failed to fetch categories:', err?.response?.data || err?.message);
        setCategories([]);
      });
  }, [gaName]);

  const normalize = s => (s || '').toLowerCase().trim();
  const hasStockData = Object.keys(siteStockMap).length > 0;

  const filteredCategories = useMemo(() => {
    if (!categoryFilter) return categories;
    const filterArray = (Array.isArray(categoryFilter) ? categoryFilter : [categoryFilter])
      .map(s => (s || '').toLowerCase().trim());
    return categories.filter(c => filterArray.includes((c.label || '').toLowerCase().trim()));
  }, [categories, categoryFilter]);

  if (filteredCategories.length === 0) {
    return (
      <p style={{ color: '#94a3b8', fontSize: 12, margin: '4px 0', fontStyle: 'italic' }}>
        {gaName
          ? 'No matching stock categories loaded from server.'
          : '📋 Select GA Location to see stock categories.'}
      </p>
    );
  }

  return (
    <>
      {filteredCategories.map(cat => {
        const isOpen = catOpen === cat.id;

        // Always show all items regardless of stock level.
        // Items with zero stock show (max: 0) in red as a visual warning.
        // Workers can still record usage — admin is responsible for receiving stock.
        // Helper: normalized lookup into initialQtys (keys may differ in case/whitespace)
        const getInitialQty = (itemName) =>
          Object.entries(initialQtys).find(([k]) => normalize(k) === normalize(itemName))?.[1] ?? 0;
        const visibleItems = cat.items;

        return (
          <div
            key={cat.id}
            style={{ border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden', marginBottom: 6 }}
          >
            {/* ── Category header ── */}
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

            {/* ── Items ── */}
            {isOpen && (
              <div
                style={{
                  padding: '8px 12px',
                  background: 'white',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 5,
                }}
              >
                {!hasStockData && !gaName && (
                  <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 6px', fontStyle: 'italic' }}>
                    📋 Select GA Location to see available stock only
                  </p>
                )}

                {visibleItems.map(item => {
                  const key = `${cat.id}__${item}`;
                  const val = catQtys[key] ?? catQtys[item] ?? 0;
                  const rawAvailable =
                    Object.entries(siteStockMap).find(([k]) => normalize(k) === normalize(item))?.[1] ?? null;
                  // In edit mode, the available stock for THIS entry's previously-used items
                  // already has initialQty deducted. Restore it so the max hint is accurate.
                  const prefilledQty = getInitialQty(item);
                  const available = rawAvailable !== null ? rawAvailable + prefilledQty : null;

                  return (
                    <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <label style={{ flex: 1, fontSize: 11.5, color: '#374151', lineHeight: 1.3 }}>
                        {item}
                        {available !== null && (
                          <span
                            style={{
                              fontSize: 10,
                              color: available > 0 ? '#16a34a' : '#dc2626',
                              marginLeft: 4,
                            }}
                          >
                            (max: {available})
                          </span>
                        )}
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        max={available !== null && available > 0 ? available : undefined}
                        value={val === 0 ? '' : val}
                        onFocus={e => e.target.select()}
                        onChange={e => {
                          const num = e.target.value === '' ? 0 : Number(e.target.value);
                          // Only cap to available when stock is actually > 0 (prevents over-issue from a stocked inventory)
                          // When available is 0 or null, allow any value — worker records actual usage regardless of stock
                          const capped = (available !== null && available > 0) ? Math.min(num, available) : num;
                          setCatQtys(prev => ({ ...prev, [key]: capped }));
                        }}
                        onBlur={e => {
                          if (e.target.value === '') setCatQtys(prev => ({ ...prev, [key]: 0 }));
                        }}
                        placeholder="0"
                        style={{
                          width: 70,
                          height: 28,
                          border:
                            available !== null && val > available
                              ? '1px solid #dc2626'
                              : '1px solid #d1d5db',
                          borderRadius: 4,
                          padding: '0 6px',
                          fontSize: 12,
                          textAlign: 'right',
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
