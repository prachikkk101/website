/**
 * DEEP DIAGNOSTIC: Check ALL StockMaterial rows (including hidden)
 * to understand why default items aren't appearing in the UI.
 *
 * Run: npx ts-node --project tsconfig.json scripts/diagnose-hidden-materials.ts
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
  console.log('='.repeat(70));
  console.log('DEEP DIAGNOSTIC: StockMaterial rows (ALL including hidden)');
  console.log('='.repeat(70));

  const cats = await prisma.stockCategory.findMany({
    where: { gaName: { not: '' } },
    orderBy: [{ gaName: 'asc' }, { name: 'asc' }],
    include: { materials: { orderBy: { name: 'asc' } } },
  });

  let totalVisible = 0;
  let totalHidden = 0;

  for (const cat of cats) {
    const visible = (cat.materials || []).filter((m: any) => !m.isHidden);
    const hidden  = (cat.materials || []).filter((m: any) => m.isHidden);
    totalVisible += visible.length;
    totalHidden  += hidden.length;

    if (cat.materials.length > 0) {
      console.log(`\n[GA="${cat.gaName}"] Category: "${cat.name}" (id=${cat.id})`);
      console.log(`  ${visible.length} visible, ${hidden.length} hidden`);
      if (visible.length > 0) {
        console.log('  VISIBLE:');
        for (const m of visible) console.log(`    ✓ id=${m.id} "${m.name}"`);
      }
      if (hidden.length > 0) {
        console.log('  HIDDEN (these BLOCK the matching frontend default):');
        for (const m of hidden) console.log(`    ✗ id=${m.id} "${m.name}" ← hiddenDefault`);
      }
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`TOTALS: ${totalVisible} visible materials, ${totalHidden} hidden materials`);
  console.log('='.repeat(70));

  // Summary: categories with hidden materials per GA
  const byGA: Record<string, {cat: string, hidden: string[]}[]> = {};
  for (const cat of cats) {
    const hidden = (cat.materials || []).filter((m: any) => m.isHidden).map((m: any) => m.name);
    if (hidden.length > 0) {
      if (!byGA[cat.gaName]) byGA[cat.gaName] = [];
      byGA[cat.gaName].push({ cat: cat.name, hidden });
    }
  }

  if (Object.keys(byGA).length === 0) {
    console.log('\n✅ No hidden materials found — the items should be showing from JS defaults.');
    console.log('   If items are still not visible, the issue is in the frontend rendering or buildAccordionCategories.');
  } else {
    console.log('\n⚠️  HIDDEN MATERIALS FOUND — these block frontend default items from displaying:');
    for (const [gaName, items] of Object.entries(byGA)) {
      console.log(`\n  GA: "${gaName}"`);
      for (const { cat, hidden } of items) {
        console.log(`    Category "${cat}": ${hidden.length} hidden items`);
        for (const h of hidden) console.log(`      - "${h}"`);
      }
    }
  }
}

main()
  .catch(e => { console.error('\n❌ Script failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
