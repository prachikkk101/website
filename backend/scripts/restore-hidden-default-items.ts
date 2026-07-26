/**
 * RESTORE: Un-hide all StockMaterial rows that correspond to DEFAULT_MATERIALS_BY_CATEGORY items.
 *
 * The backfill script copied isHidden=true from global categories to per-GA categories,
 * blocking all original default items from displaying in the UI.
 *
 * This script ONLY un-hides items whose names match the DEFAULT list for their category.
 * It does NOT un-hide truly admin-deleted custom items (e.g. "G-6 POLARIS METER", "cassing pipe").
 *
 * Run: npx ts-node --project tsconfig.json scripts/restore-hidden-default-items.ts
 */
import dotenv from 'dotenv';
// @ts-ignore
import { PrismaClient } from '@prisma/client';
// @ts-ignore
import { PrismaPg } from '@prisma/adapter-pg';
// @ts-ignore
import { Pool } from 'pg';

dotenv.config();

// ── The authoritative original item list from git history / src/utils/stockCategories.js ──
const DEFAULT_MATERIALS_BY_CATEGORY: Record<string, string[]> = {
  'FIM Material': [
    '32mm PE Pipe', '63mm PE Pipe', '90mm PE Pipe', '125mm PE Pipe', '20mm PE Pipe',
    '32mm PE Valve', '63mm PE Valve', '90mm PE Valve', '125mm PE Valve',
    '20mm Coupler', '32mm Coupler', '63mm Coupler', '90mm Coupler', '125mm Coupler',
    '20mm Tee', '32mm Tee', '63mm Tee', '90mm Tee', '125mm Tee',
    '20mm End Cap', '32mm End Cap', '63mm End Cap', '90mm End Cap', '125mm End Cap',
    '32mm Elbow', '63mm Elbow', '90mm Elbow', '125mm Elbow',
    '32/20 Saddle', '63/20 Saddle', '63/32 Saddle', '90/63 Saddle', '125/63 Saddle',
    '32/20 Reducer', '63/32 Reducer', '90/63 Reducer', '125/90 Reducer',
    '20mm T/F \u00bd"', '32mm T/F 1"', '63mm T/F 2"',
    'Warning Mate', 'Rubber Tube',
  ],
  'GI Fitting \u2014 \u00bd inch': [
    '\u00bd" GI Clamp', '\u00bd" GI Elbow', '\u00bd" GI Socket', '\u00bd" GI M/F Elbow',
    '\u00bd" GI Nipple 2"', '\u00bd" GI Nipple 3"', '\u00bd" GI Nipple 4"', '\u00bd" GI Nipple 5"', '\u00bd" GI Nipple 6"',
    'Meter Adaptor', 'Teflon Tape',
    '\u00bd" GI Tee', '\u00bd" T/F', '\u00bd" T/F Fusion',
    '\u00bd" Ball Valve (IV)', '\u00bd" Gas Tape (AV)',
    'Rubber Tube Clamp', 'Anti Corrosive Tape', 'PVC Pipe 1"',
  ],
  'GI Fitting \u2014 \u00be inch': [
    '\u00be" GI Clamp', '\u00be" GI Elbow', '\u00be" GI Socket', '\u00be" GI M/F Elbow', '\u00be" GI Pipe',
    '\u00be" GI Nipple 2"', '\u00be" GI Nipple 3"', '\u00be" GI Nipple 4"', '\u00be" GI Nipple 5"', '\u00be" GI Nipple 6"',
    '\u00be" Ball Valve (IV)', '\u00be" GI Tee', '\u00be"/\u00bd" Tee',
  ],
  'GI Fitting \u2014 1 inch': [
    '\u00bd" GI End Cap', '1" GI Pipe', '1" GI Clamp', '1" GI Elbow', '1" GI M/F Elbow', '1" GI Socket',
    '1" GI Nipple 2"', '1" GI Nipple 3"', '1" GI Nipple 4"', '1" GI Nipple 5"', '1" GI Nipple 6"',
    '1" GI Tee', '1"/\u00bd" GI Tee', '1" Ball Valve (IV)', '\u00bd" Union',
  ],
  'MDPE Fittings': [
    '20mm Coupler', '32mm Coupler', '63mm Coupler', '90mm Coupler', '125mm Coupler',
    '20mm Tee', '32mm Tee', '63mm Tee', '90mm Tee', '125mm Tee',
    '32mm Elbow', '63mm Elbow', '90mm Elbow', '125mm Elbow',
    '20mm End Cap', '32mm End Cap', '63mm End Cap', '90mm End Cap', '125mm End Cap',
    '32/20 Saddle', '63/20 Saddle', '63/32 Saddle', '90/63 Saddle', '125/63 Saddle',
    '32/20 Reducer', '63/32 Reducer', '90/63 Reducer', '125/90 Reducer',
    '\u00bd" T/F Fusion', '20mm PE Pipe',
  ],
  'MLC Fittings': [
    'MLC Pipe 12mm', 'MLC Clamp', 'MLC M Union', 'MLC F Union', 'MLC Clamp B Type', 'MLC Reamer',
  ],
};

const normalize = (s: string) => (s || '').toLowerCase().trim();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any) as any;

async function main() {
  console.log('='.repeat(70));
  console.log('BEFORE STATE: Count of hidden StockMaterial rows');
  console.log('='.repeat(70));

  const beforeCount = await prisma.stockMaterial.count({ where: { isHidden: true } });
  const totalCount  = await prisma.stockMaterial.count();
  console.log(`Total StockMaterial rows: ${totalCount}`);
  console.log(`Hidden rows (before):     ${beforeCount}`);
  console.log(`Visible rows (before):    ${totalCount - beforeCount}`);

  console.log('\n' + '='.repeat(70));
  console.log('RESTORE: Un-hiding default items per category');
  console.log('='.repeat(70) + '\n');

  let totalUnhidden = 0;
  let totalAlreadyOk = 0;
  let totalSkipped = 0;

  // Load all categories with their materials (including hidden)
  const cats = await prisma.stockCategory.findMany({
    where: { gaName: { not: '' }, isHidden: false },
    include: { materials: true },
    orderBy: [{ gaName: 'asc' }, { name: 'asc' }],
  });

  for (const cat of cats) {
    const defaultItems = DEFAULT_MATERIALS_BY_CATEGORY[cat.name];
    if (!defaultItems || defaultItems.length === 0) continue; // skip categories not in defaults

    const defaultNormalized = new Set(defaultItems.map(normalize));
    const hiddenInThisCat = (cat.materials || []).filter((m: any) => m.isHidden);
    const unhideable = hiddenInThisCat.filter((m: any) => defaultNormalized.has(normalize(m.name)));
    const skippable  = hiddenInThisCat.filter((m: any) => !defaultNormalized.has(normalize(m.name)));

    if (unhideable.length === 0 && skippable.length === 0) continue;

    console.log(`[GA="${cat.gaName}"] "${cat.name}" — ${unhideable.length} to restore, ${skippable.length} to skip (not in defaults)`);

    for (const mat of unhideable) {
      await prisma.stockMaterial.update({
        where: { id: mat.id },
        data: { isHidden: false },
      });
      console.log(`  ✅ UNHID  id=${mat.id} "${mat.name}"`);
      totalUnhidden++;
    }

    for (const mat of skippable) {
      console.log(`  ⚠️  SKIP  id=${mat.id} "${mat.name}" — not a default item, left hidden`);
      totalSkipped++;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`Un-hidden: ${totalUnhidden}  |  Skipped (non-default): ${totalSkipped}  |  Already OK: ${totalAlreadyOk}`);

  const afterHidden  = await prisma.stockMaterial.count({ where: { isHidden: true } });
  const afterTotal   = await prisma.stockMaterial.count();
  console.log('\nAFTER STATE:');
  console.log(`Total StockMaterial rows: ${afterTotal}`);
  console.log(`Hidden rows (after):      ${afterHidden}`);
  console.log(`Visible rows (after):     ${afterTotal - afterHidden}`);

  // Verify: each visible category should now have all its defaults un-hidden
  console.log('\n' + '='.repeat(70));
  console.log('VERIFICATION: Expected visible items per category per GA');
  console.log('='.repeat(70));

  const verCats = await prisma.stockCategory.findMany({
    where: { gaName: { not: '' }, isHidden: false },
    include: { materials: { where: { isHidden: true } } },
    orderBy: [{ gaName: 'asc' }, { name: 'asc' }],
  });

  let allPass = true;
  for (const cat of verCats) {
    const defaultItems = DEFAULT_MATERIALS_BY_CATEGORY[cat.name];
    if (!defaultItems) continue;
    const stillHiddenDefaults = (cat.materials || []).filter((m: any) =>
      new Set(defaultItems.map(normalize)).has(normalize(m.name))
    );
    if (stillHiddenDefaults.length > 0) {
      allPass = false;
      console.log(`❌ [GA="${cat.gaName}"] "${cat.name}": ${stillHiddenDefaults.length} defaults STILL hidden`);
      for (const m of stillHiddenDefaults) console.log(`     "${m.name}"`);
    } else {
      console.log(`✅ [GA="${cat.gaName}"] "${cat.name}": all defaults now visible`);
    }
  }

  console.log('\n' + (allPass ? '✅ ALL DEFAULT ITEMS RESTORED SUCCESSFULLY.' : '❌ SOME DEFAULTS STILL HIDDEN — check above.'));
}

main()
  .catch(e => { console.error('\n❌ Script failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
