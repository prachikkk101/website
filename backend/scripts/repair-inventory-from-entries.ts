/**
 * One-time repair script: sync inventory issued/inStore from all saved entries.
 * Run ONCE after deploying the startup-sync removal fix to bring data back in sync.
 *
 * Usage (from backend/ dir):
 *   npx ts-node --transpile-only scripts/repair-inventory-from-entries.ts
 */
import prisma from '../src/config/db';

async function main() {
  console.log('🔵 Starting inventory repair from saved entries...\n');

  // 1. Fetch PNG Connections
  const pngConns = await prisma.pNGConnection.findMany({
    select: { siteId: true, materialsUsed: true, id: true },
  });
  console.log(`📋 PNG Connections loaded: ${pngConns.length}`);

  // 2. Fetch PE Laying entries
  const peEntries = await prisma.pELaying.findMany({
    select: { siteId: true, mdpeMaterials: true, id: true },
  });
  console.log(`📋 PE Laying entries loaded: ${peEntries.length}`);

  // Map: siteId -> materialName -> totalIssued
  const issuedMap = new Map<string, Map<string, number>>();

  const addIssued = (siteId: string, mat: string, qty: number) => {
    if (!siteId || !mat.trim() || qty <= 0) return;
    const cleanMat = mat.trim();
    if (!issuedMap.has(siteId)) issuedMap.set(siteId, new Map());
    const m = issuedMap.get(siteId)!;
    m.set(cleanMat, (m.get(cleanMat) ?? 0) + Math.round(qty));
  };

  for (const c of pngConns) {
    const mats = c.materialsUsed as any[];
    if (Array.isArray(mats)) {
      for (const m of mats) {
        if (m?.material && Number(m?.qty) > 0) addIssued(c.siteId, m.material, Number(m.qty));
      }
    }
  }

  for (const p of peEntries) {
    const mats = p.mdpeMaterials as any[];
    if (Array.isArray(mats)) {
      for (const m of mats) {
        if (m?.material && Number(m?.qty) > 0) addIssued(p.siteId, m.material, Number(m.qty));
      }
    }
  }

  const totalMaterials = [...issuedMap.values()].reduce((a, m) => a + m.size, 0);
  console.log(`\n📊 Material+site combinations to reconcile: ${totalMaterials}\n`);

  let updated = 0;
  let skipped = 0;

  for (const [siteId, matMap] of issuedMap.entries()) {
    const allItems = await prisma.inventoryItem.findMany({ where: { siteId } });
    const byNorm = new Map<string, typeof allItems[0]>();
    for (const item of allItems) byNorm.set(item.material.trim().toLowerCase(), item);

    for (const [matName, calcIssued] of matMap.entries()) {
      const existing = byNorm.get(matName.toLowerCase());
      if (existing) {
        const newInStore = existing.received - calcIssued - existing.returned;
        await prisma.inventoryItem.update({
          where: { id: existing.id },
          data: { issued: calcIssued, inStore: newInStore, updatedAt: new Date() },
        });
        console.log(`  ✅ [${siteId}] "${matName}": issued=${calcIssued}, inStore=${newInStore}`);
        updated++;
      } else {
        console.log(`  ⚠️ [${siteId}] "${matName}": NOT IN INVENTORY — skipped (qty=${calcIssued})`);
        skipped++;
      }
    }
  }

  console.log(`\n✅ Repair complete. Updated: ${updated} | Skipped (not in inventory): ${skipped}`);
}

main()
  .catch(e => { console.error('❌ Repair failed:', e); process.exit(1); })
  .finally(() => (prisma as any).$disconnect());
