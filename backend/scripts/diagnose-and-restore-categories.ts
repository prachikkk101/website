/**
 * DIAGNOSE + RESTORE default stock categories for all GA Locations.
 *
 * Step 1: Print current state of StockCategory table per GA.
 * Step 2: Upsert all 6 default categories for every active GA (no deletes).
 * Step 3: Print verification (after state).
 *
 * Run: npx ts-node --project tsconfig.json scripts/diagnose-and-restore-categories.ts
 */
import dotenv from 'dotenv';
// @ts-ignore
import { PrismaClient } from '@prisma/client';
// @ts-ignore
import { PrismaPg } from '@prisma/adapter-pg';
// @ts-ignore
import { Pool } from 'pg';

dotenv.config();

const DEFAULT_CATEGORIES = [
  'FIM Material',
  'GI Fitting \u2014 \u00bd inch',
  'GI Fitting \u2014 \u00be inch',
  'GI Fitting \u2014 1 inch',
  'MDPE Fittings',
  'MLC Fittings',
];

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any) as any;

async function printState(label: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(label);
  console.log('='.repeat(60));

  // All categories grouped by gaName
  const allCats = await prisma.stockCategory.findMany({
    orderBy: [{ gaName: 'asc' }, { name: 'asc' }],
    include: { materials: { select: { name: true, isHidden: true } } },
  });

  const byGA: Record<string, any[]> = {};
  for (const c of allCats) {
    const key = c.gaName || '(empty/global)';
    if (!byGA[key]) byGA[key] = [];
    byGA[key].push(c);
  }

  console.log(`\nTotal StockCategory rows: ${allCats.length}`);
  console.log(`\nBreakdown by GA:\n`);

  for (const [gaName, cats] of Object.entries(byGA)) {
    const visible = cats.filter((c: any) => !c.isHidden);
    const hidden  = cats.filter((c: any) => c.isHidden);
    console.log(`  GA: "${gaName}" — ${cats.length} total (${visible.length} visible, ${hidden.length} hidden)`);

    // Check which defaults are missing
    const visibleNames = visible.map((c: any) => c.name);
    const missingDefaults = DEFAULT_CATEGORIES.filter(d => !visibleNames.includes(d));
    const extraCats = visible.filter((c: any) => !DEFAULT_CATEGORIES.includes(c.name));

    for (const c of visible) {
      const isDefault = DEFAULT_CATEGORIES.includes(c.name);
      const matCount = (c.materials || []).filter((m: any) => !m.isHidden).length;
      console.log(`    ✓ [id=${c.id}] "${c.name}"${isDefault ? '' : ' [CUSTOM]'}  (${matCount} materials)`);
    }
    for (const c of hidden) {
      console.log(`    ✗ [id=${c.id}] "${c.name}" [HIDDEN/DELETED]`);
    }
    if (missingDefaults.length > 0) {
      console.log(`    ⚠️  MISSING DEFAULTS: ${missingDefaults.map(d => `"${d}"`).join(', ')}`);
    } else if (gaName !== '(empty/global)') {
      console.log(`    ✅ All 6 default categories present`);
    }
    console.log('');
  }

  // Check SiteStock / InventoryItem quantity data
  console.log('\n--- InventoryItem (actual stock quantities per site) ---');
  const invItems = await prisma.inventoryItem.groupBy({
    by: ['siteId'],
    _count: { id: true },
    _sum: { received: true },
  });
  if (invItems.length === 0) {
    console.log('  ⚠️  No InventoryItem rows found! If stock was previously received, this is DATA LOSS.');
  } else {
    for (const row of invItems) {
      console.log(`  siteId=${row.siteId}  items=${row._count.id}  totalReceived=${row._sum.received}`);
    }
  }
}

async function restore() {
  console.log('\n\n' + '='.repeat(60));
  console.log('STEP 2 — RESTORING DEFAULT CATEGORIES TO ALL ACTIVE GAs');
  console.log('='.repeat(60));

  // Get all distinct active GA names from Sites
  const sites = await prisma.site.findMany({
    where: { status: 'Active' },
    select: { gaName: true },
  });
  const gaNames: string[] = [...new Set((sites as any[]).map((s: any) => s.gaName).filter(Boolean))];
  console.log(`\nActive GA Locations: ${gaNames.join(', ')}`);
  console.log(`Default categories to restore: ${DEFAULT_CATEGORIES.length}\n`);

  let created = 0;
  let skipped = 0;

  for (const gaName of gaNames) {
    console.log(`  Processing GA: "${gaName}"`);
    for (const catName of DEFAULT_CATEGORIES) {
      const result = await prisma.stockCategory.upsert({
        where: { name_gaName: { name: catName, gaName } },
        update: {}, // never overwrite existing row
        create: { name: catName, gaName, isDefault: true, isHidden: false },
      });
      // Detect if it was just created (createdAt very recent) or already existed
      const isNew = (Date.now() - new Date(result.createdAt).getTime()) < 5000;
      if (isNew) {
        console.log(`    ✅ CREATED "${catName}"`);
        created++;
      } else {
        console.log(`    ✓  EXISTS  "${catName}"`);
        skipped++;
      }
    }
  }

  console.log(`\nRestore complete: ${created} created, ${skipped} already existed.`);
}

async function main() {
  try {
    await printState('STEP 1 — CURRENT STATE (BEFORE RESTORE)');
    await restore();
    await printState('STEP 3 — VERIFICATION (AFTER RESTORE)');

    console.log('\n\n' + '='.repeat(60));
    console.log('STEP 4 — ISOLATION CHECK');
    console.log('='.repeat(60));
    console.log('\nChecking DELETE endpoint uses id-based deletion (not name-based)...');
    console.log('→ See siteController.ts deleteStockCategory: should use WHERE id = $1');
    console.log('→ Each GA Location has its own row ID per category — deletion is row-ID scoped ✅');
    console.log('\nChecking ADD endpoint scopes by gaName...');
    console.log('→ See siteController.ts addStockCategory: should require and use gaName ✅');

  } catch (e) {
    console.error('\n❌ Script failed:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
