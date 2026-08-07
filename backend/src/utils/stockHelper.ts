import prisma from '../config/db';

/**
 * Adjust issued and inStore stock for a material at a given site.
 * - Searches for exact match first, then case-insensitive / trimmed match.
 * - If found: updates issued += delta, inStore = received - issued - returned.
 * - If NOT found: logs a warning and skips — does NOT create phantom rows.
 *   Phantom rows (received:0, issued:N) cause confusing negative inStore values.
 */
export async function adjustInventoryStock(siteId: string, materialName: string, delta: number) {
  if (!siteId || !materialName || delta === 0) return;
  const name = materialName.trim();
  if (!name) return;

  try {
    // 1. Try exact match first
    let invItem = await prisma.inventoryItem.findUnique({
      where: { siteId_material: { siteId, material: name } },
    });

    // 2. If exact match not found, try case-insensitive / trimmed match for siteId
    if (!invItem) {
      const siteItems = await prisma.inventoryItem.findMany({
        where: { siteId },
        select: { id: true, material: true, received: true, issued: true, returned: true, inStore: true },
      });
      const match = siteItems.find(i => i.material.trim().toLowerCase() === name.toLowerCase());
      if (match) {
        invItem = match as any;
      }
    }

    const roundDelta = Math.round(delta);

    // 3. If found, update
    if (invItem) {
      const newIssued = Math.max(0, invItem.issued + roundDelta);
      const newInStore = invItem.received - newIssued - invItem.returned;
      await prisma.inventoryItem.update({
        where: { id: invItem.id },
        data: { issued: newIssued, inStore: newInStore, updatedAt: new Date() },
      });
      console.log(`[stockHelper] ✅ Updated "${invItem.material}" for site ${siteId}: delta=${roundDelta >= 0 ? '+' : ''}${roundDelta}, issued=${newIssued}, inStore=${newInStore}`);
    } else {
      // 4. Material not in inventory — log warning, do NOT create phantom row.
      // Phantom rows (received:0, issued:N, inStore:-N) are confusing and pollute inventory.
      // Admins must first receive this material in the Inventory page before it can be deducted.
      console.warn(`[stockHelper] ⚠️ SKIP — "${name}" not found in inventory for site ${siteId}. Delta=${roundDelta} not applied. Receive this material in the Inventory page first.`);
    }
  } catch (err: any) {
    console.error(`[stockHelper] ❌ Stock adjustment failed for "${name}" (site: ${siteId}):`, err.message);
  }
}

/**
 * Full inventory recalculation from all PNG connections and PE laying entries for a site.
 * Resets issued/inStore to match actual usage stored in entry records.
 *
 * IMPORTANT: Only call this manually (via admin endpoint) — never on server startup.
 * Running on startup overwrites incremental deductions from entries saved before
 * mdpeMaterials/materialsUsed fields were tracked.
 */
export async function syncSiteInventoryFromEntries(siteId?: string) {
  try {
    const siteWhere = siteId && siteId !== 'all' ? { siteId } : {};

    // 1. Fetch PNG Connections
    const pngConns = await prisma.pNGConnection.findMany({
      where: siteWhere,
      select: { siteId: true, materialsUsed: true },
    });

    // 2. Fetch PE Laying entries
    const peEntries = await prisma.pELaying.findMany({
      where: siteWhere,
      select: { siteId: true, mdpeMaterials: true },
    });

    // Map: siteId -> material -> issuedQty
    const siteMaterialIssuedMap = new Map<string, Map<string, number>>();

    const addIssued = (sId: string, matName: string, qty: number) => {
      if (!sId || !matName || qty <= 0) return;
      const cleanMat = matName.trim();
      if (!siteMaterialIssuedMap.has(sId)) {
        siteMaterialIssuedMap.set(sId, new Map());
      }
      const matMap = siteMaterialIssuedMap.get(sId)!;
      matMap.set(cleanMat, (matMap.get(cleanMat) || 0) + Math.round(qty));
    };

    // Process PNG Connections
    for (const c of pngConns) {
      const mats = c.materialsUsed as any[];
      if (Array.isArray(mats)) {
        for (const m of mats) {
          if (m?.material && Number(m?.qty) > 0) {
            addIssued(c.siteId, m.material, Number(m.qty));
          }
        }
      }
    }

    // Process PE Laying entries
    for (const p of peEntries) {
      const mats = p.mdpeMaterials as any[];
      if (Array.isArray(mats)) {
        for (const m of mats) {
          if (m?.material && Number(m?.qty) > 0) {
            addIssued(p.siteId, m.material, Number(m.qty));
          }
        }
      }
    }

    // Now update EXISTING InventoryItems — do NOT create new ones for missing materials
    let updated = 0;
    let skipped = 0;
    for (const [sId, matMap] of siteMaterialIssuedMap.entries()) {
      const existingItems = await prisma.inventoryItem.findMany({ where: { siteId: sId } });
      const itemByNormName = new Map<string, typeof existingItems[0]>();
      for (const item of existingItems) {
        itemByNormName.set(item.material.trim().toLowerCase(), item);
      }

      for (const [matName, calcIssued] of matMap.entries()) {
        const norm = matName.toLowerCase();
        const existing = itemByNormName.get(norm);

        if (existing) {
          const inStore = existing.received - calcIssued - existing.returned;
          await prisma.inventoryItem.update({
            where: { id: existing.id },
            data: { issued: calcIssued, inStore, updatedAt: new Date() },
          });
          console.log(`[sync] ✅ "${matName}" site ${sId}: issued=${calcIssued}, inStore=${inStore}`);
          updated++;
        } else {
          // Material used in an entry but not in inventory — skip, don't create phantom row
          console.warn(`[sync] ⚠️ SKIP "${matName}" (site ${sId}) — not in inventory. Receive it first.`);
          skipped++;
        }
      }
    }

    console.log(`🟢 Inventory stock sync complete. Updated: ${updated}, Skipped (not in inventory): ${skipped}`);
  } catch (err: any) {
    console.error('❌ Inventory stock sync error:', err.message);
  }
}
