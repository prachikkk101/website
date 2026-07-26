/**
 * RESTORE: Un-hide the 3 default categories that were soft-deleted for all GAs.
 *
 * Diagnosis showed these 3 defaults are isHidden=true across all GA Locations:
 *   - "GI Fitting — ¾ inch"
 *   - "GI Fitting — 1 inch"
 *   - "MLC Fittings"
 *
 * This script un-hides them (sets isHidden=false) for all GAs,
 * and also upsert-creates any that are completely missing (safety net).
 *
 * Does NOT touch: G-6 POLARIS METER, cassing pipe (intentionally hidden),
 *                 or "GI Fitting - 1"" (custom admin category, keep as-is).
 *
 * Run: npx ts-node --project tsconfig.json scripts/restore-hidden-defaults.ts
 */
import dotenv from 'dotenv';
// @ts-ignore
import { PrismaClient } from '@prisma/client';
// @ts-ignore
import { PrismaPg } from '@prisma/adapter-pg';
// @ts-ignore
import { Pool } from 'pg';

dotenv.config();

const DEFAULTS_TO_RESTORE = [
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

async function main() {
  console.log('='.repeat(60));
  console.log('RESTORE: Un-hiding soft-deleted default categories');
  console.log('='.repeat(60));

  // Get all distinct active GA names
  const sites = await prisma.site.findMany({
    where: { status: 'Active' },
    select: { gaName: true },
  });
  const gaNames: string[] = [...new Set((sites as any[]).map((s: any) => s.gaName).filter(Boolean))];
  console.log(`\nActive GAs: ${gaNames.join(', ')}\n`);

  let unhidden = 0;
  let created = 0;
  let alreadyOk = 0;

  for (const gaName of gaNames) {
    console.log(`GA: "${gaName}"`);
    for (const catName of DEFAULTS_TO_RESTORE) {
      // Use upsert: if exists, always set isHidden=false + isDefault=true
      //            if missing, create it fresh
      const existing = await prisma.stockCategory.findUnique({
        where: { name_gaName: { name: catName, gaName } },
      });

      if (!existing) {
        await prisma.stockCategory.create({
          data: { name: catName, gaName, isDefault: true, isHidden: false },
        });
        console.log(`  ✅ CREATED "${catName}"`);
        created++;
      } else if (existing.isHidden) {
        await prisma.stockCategory.update({
          where: { id: existing.id },
          data: { isHidden: false, isDefault: true },
        });
        console.log(`  ✅ UNHID  "${catName}" (was isHidden=true, id=${existing.id})`);
        unhidden++;
      } else {
        console.log(`  ✓  OK     "${catName}"`);
        alreadyOk++;
      }
    }
    console.log('');
  }

  console.log('='.repeat(60));
  console.log(`Unhidden: ${unhidden}  |  Created: ${created}  |  Already OK: ${alreadyOk}`);

  // VERIFICATION
  console.log('\n\nVERIFICATION — State after restore:\n');
  const allCats = await prisma.stockCategory.findMany({
    where: { gaName: { not: '' } },
    orderBy: [{ gaName: 'asc' }, { isHidden: 'asc' }, { name: 'asc' }],
  });

  const byGA: Record<string, any[]> = {};
  for (const c of allCats) {
    if (!byGA[c.gaName]) byGA[c.gaName] = [];
    byGA[c.gaName].push(c);
  }

  let allPass = true;
  for (const [gaName, cats] of Object.entries(byGA)) {
    const visibleNames = cats.filter((c: any) => !c.isHidden).map((c: any) => c.name);
    const missing = DEFAULTS_TO_RESTORE.filter(d => !visibleNames.includes(d));
    const pass = missing.length === 0;
    if (!pass) allPass = false;
    console.log(`  ${pass ? '✅' : '❌'} GA "${gaName}": ${visibleNames.length} visible cats. ${pass ? 'All 6 defaults present.' : `MISSING: ${missing.join(', ')}`}`);
  }

  console.log('\n' + (allPass
    ? '✅ ALL GA LOCATIONS HAVE ALL 6 DEFAULT CATEGORIES.'
    : '❌ SOME DEFAULTS ARE STILL MISSING — check above.'));

  // InventoryItem check
  console.log('\n--- InventoryItem quantity check ---');
  const inv = await prisma.inventoryItem.findMany({ take: 5 });
  if (inv.length === 0) {
    console.log('ℹ️  No InventoryItem rows. This is expected if stock has never been received.');
    console.log('   (Stock categories are just the template — actual received quantities live in InventoryItem.)');
  } else {
    console.log(`Found ${inv.length} InventoryItem rows (showing first 5):`);
    for (const i of inv) console.log(`  siteId=${i.siteId} material="${i.material}" received=${i.received}`);
  }
}

main()
  .catch(e => { console.error('\n❌ Script failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
