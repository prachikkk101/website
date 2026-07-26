/**
 * Backfill: scope stock categories to GA Location.
 * 
 * For each existing global category (gaName=''), creates one copy per GA Location,
 * duplicating all its materials. DOES NOT delete the gaName='' placeholder rows —
 * deletion is a separate, explicitly confirmed step.
 *
 * Run: npx ts-node --project tsconfig.json scripts/backfill-ga-categories.ts
 */
import dotenv from 'dotenv';
// @ts-ignore
import { PrismaClient } from '@prisma/client';
// @ts-ignore
import { PrismaPg } from '@prisma/adapter-pg';
// @ts-ignore
import { Pool } from 'pg';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any) as any;

async function main() {
  console.log('\n══════════════════════════════════════════════════');
  console.log('BACKFILL: SCOPE STOCK CATEGORIES PER GA LOCATION');
  console.log('══════════════════════════════════════════════════');

  // 1. Get all existing GLOBAL categories (gaName = '') before partitioning
  const globalCats = await prisma.stockCategory.findMany({
    where: { gaName: '' },
    include: { materials: { select: { id: true, name: true, isHidden: true } } },
    orderBy: { id: 'asc' },
  });
  console.log(`\n[1/4] Found ${globalCats.length} global categories (gaName='')`);
  for (const c of globalCats) {
    console.log(`      [id=${c.id}] "${c.name}" isHidden=${c.isHidden} mats=${c.materials.length}`);
  }

  // 2. Get all distinct active GA names from Site
  const sites = await prisma.site.findMany({ where: { status: 'Active' }, select: { gaName: true } });
  const gaNames: string[] = [...new Set((sites as any[]).map((s: any) => s.gaName).filter(Boolean))];
  console.log(`\n[2/4] Found ${gaNames.length} GA Locations: ${gaNames.join(', ')}`);

  // 3. For each GA × each category: upsert category row + copy its materials
  console.log('\n[3/4] Creating per-GA category copies...');
  let categoriesCreated = 0;
  let materialsCreated = 0;

  for (const gaName of gaNames) {
    console.log(`\n  ── GA: "${gaName}" ──`);
    for (const cat of globalCats) {
      const newCat = await prisma.stockCategory.upsert({
        where: { name_gaName: { name: cat.name, gaName } },
        update: {}, // don't overwrite if already exists
        create: {
          name: cat.name,
          gaName,
          parentGroup: cat.parentGroup ?? null,
          isDefault: cat.isDefault,
          isHidden: cat.isHidden,
        },
      });
      categoriesCreated++;
      console.log(`    ✓ Category [id=${newCat.id}] "${newCat.name}" gaName="${newCat.gaName}"`);

      for (const mat of cat.materials) {
        await prisma.stockMaterial.upsert({
          where: { name_categoryId: { name: mat.name, categoryId: newCat.id } },
          update: {}, // don't overwrite if already exists
          create: { name: mat.name, categoryId: newCat.id, isHidden: mat.isHidden },
        });
        materialsCreated++;
      }
      if (cat.materials.length > 0) {
        console.log(`      ↳ Copied ${cat.materials.length} material(s)`);
      }
    }
  }
  console.log(`\n  Created/confirmed ${categoriesCreated} GA-scoped category rows`);
  console.log(`  Created/confirmed ${materialsCreated} GA-scoped material rows`);

  // 4. Verify post-backfill counts (BEFORE deleting placeholders)
  const totalCats = await prisma.stockCategory.count();
  const gaNamedCats = await prisma.stockCategory.count({ where: { gaName: { not: '' } } });
  const placeholderCats = await prisma.stockCategory.count({ where: { gaName: '' } });
  const totalMats = await prisma.stockMaterial.count();

  console.log('\n[4/4] POST-BACKFILL COUNT VERIFICATION (placeholders NOT yet deleted):');
  console.log(`  Total StockCategory rows    : ${totalCats}`);
  console.log(`  GA-scoped rows (gaName != ''): ${gaNamedCats}`);
  console.log(`  Placeholder rows (gaName=''): ${placeholderCats} <-- will be deleted after confirmation`);
  console.log(`  Total StockMaterial rows    : ${totalMats}`);
  console.log(`  Expected GA-scoped cats     : ${globalCats.length} × ${gaNames.length} = ${globalCats.length * gaNames.length}`);
  console.log(`  Match: ${gaNamedCats === globalCats.length * gaNames.length ? '✅ YES' : '❌ NO — STOP, do not delete placeholders'}`);
  console.log('══════════════════════════════════════════════════');
  console.log('\n⚠️  Placeholder rows (gaName="") NOT deleted yet.');
  console.log('   Review the counts above. If they look correct, run:');
  console.log('   npx ts-node --project tsconfig.json scripts/delete-ga-placeholders.ts');
  console.log('══════════════════════════════════════════════════\n');
}

main()
  .catch(e => { console.error('❌ Backfill failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
