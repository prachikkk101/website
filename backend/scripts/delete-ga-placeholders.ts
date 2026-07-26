/**
 * DELETE PLACEHOLDER ROWS (gaName = '').
 * Run ONLY after verifying backfill counts are correct via backfill-ga-categories.ts.
 *
 * Run: npx ts-node --project tsconfig.json scripts/delete-ga-placeholders.ts
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
  console.log('DELETE PLACEHOLDER CATEGORIES (gaName="")');
  console.log('══════════════════════════════════════════════════');

  // Final safety check before deleting
  const gaNamedCats = await prisma.stockCategory.count({ where: { gaName: { not: '' } } });
  const placeholderCats = await prisma.stockCategory.count({ where: { gaName: '' } });
  const sites = await prisma.site.findMany({ where: { status: 'Active' }, select: { gaName: true } });
  const gaCount = new Set((sites as any[]).map((s: any) => s.gaName).filter(Boolean)).size;

  console.log(`GA-scoped rows  : ${gaNamedCats}`);
  console.log(`Placeholder rows: ${placeholderCats}`);
  console.log(`GA Locations    : ${gaCount}`);

  if (gaNamedCats === 0) {
    console.error('❌ No GA-scoped rows found! Did the backfill run? Aborting.');
    process.exit(1);
  }

  // Delete placeholder categories (cascades to their StockMaterial rows)
  const deleted = await prisma.stockCategory.deleteMany({ where: { gaName: '' } });
  console.log(`\n✅ Deleted ${deleted.count} placeholder StockCategory rows (and their materials via cascade)`);

  // Final count
  const finalCats = await prisma.stockCategory.count();
  const finalMats = await prisma.stockMaterial.count();
  console.log(`\nFinal StockCategory count: ${finalCats}`);
  console.log(`Final StockMaterial count: ${finalMats}`);
  console.log('══════════════════════════════════════════════════\n');
}

main()
  .catch(e => { console.error('❌ Deletion failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
