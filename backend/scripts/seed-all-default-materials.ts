/**
 * SEED/RESTORE ALL DEFAULT STOCK MATERIALS TO NEON DB
 *
 * Ensures every GA Location has all 123 default StockMaterial rows
 * created and visible (isHidden: false) in the PostgreSQL database.
 *
 * Run: npx ts-node --project tsconfig.json scripts/seed-all-default-materials.ts
 */
import dotenv from 'dotenv';
// @ts-ignore
import { PrismaClient } from '@prisma/client';
// @ts-ignore
import { PrismaPg } from '@prisma/adapter-pg';
// @ts-ignore
import { Pool } from 'pg';

dotenv.config();

const DEFAULT_MATERIALS_BY_CATEGORY: Record<string, string[]> = {
  'FIM Material': [
    '32mm PE Pipe', '63mm PE Pipe', '90mm PE Pipe', '125mm PE Pipe', '20mm PE Pipe',
    '32mm PE Valve', '63mm PE Valve', '90mm PE Valve', '125mm PE Valve',
    '20mm Coupler', '32mm Coupler', '63mm Coupler', '125mm Coupler',
    '20mm Tee', '32mm Tee', '63mm Tee', '125mm Tee',
    '20mm End Cap', '32mm End Cap', '63mm End Cap', '90mm End Cap', '125mm End Cap',
    '32mm Elbow', '63mm Elbow', '90mm Elbow', '125mm Elbow',
    '32/20 Saddle', '63/20 Saddle', '63/32 Saddle', '90/63 Saddle', '125/63 Saddle',
    '32/20 Reducer', '63/32 Reducer', '90/63 Reducer', '125/90 Reducer',
    '20mm T/F ½"', '32mm T/F 1"', '63mm T/F 2"', 'Warning Mate', 'Rubber Tube',
  ],
  'GI Fitting — ½ inch': [
    '½" GI Clamp', '½" GI Elbow', '½" GI Socket', '½" GI M/F Elbow',
    '½" GI Nipple 2"', '½" GI Nipple 3"', '½" GI Nipple 4"', '½" GI Nipple 5"', '½" GI Nipple 6"',
    'Meter Adaptor', 'Teflon Tape', '½" GI Tee', '½" T/F', '½" T/F Fusion',
    '½" Ball Valve (IV)', '½" Gas Tape (AV)', 'Rubber Tube Clamp', 'Anti Corrosive Tape', 'PVC Pipe 1"',
  ],
  'GI Fitting — ¾ inch': [
    '¾" GI Clamp', '¾" GI Elbow', '¾" GI Socket', '¾" GI M/F Elbow', '¾" GI Pipe',
    '¾" GI Nipple 2"', '¾" GI Nipple 3"', '¾" GI Nipple 4"', '¾" GI Nipple 5"', '¾" GI Nipple 6"',
    '¾" Ball Valve (IV)', '¾" GI Tee', '¾"/½" Tee',
  ],
  'GI Fitting — 1 inch': [
    '½" GI End Cap', '1" GI Pipe', '1" GI Clamp', '1" GI Elbow', '1" GI M/F Elbow', '1" GI Socket',
    '1" GI Nipple 2"', '1" GI Nipple 3"', '1" GI Nipple 4"', '1" GI Nipple 5"', '1" GI Nipple 6"',
    '1" GI Tee', '1"/½" GI Tee', '1" Ball Valve (IV)', '½" Union',
  ],
  'MDPE Fittings': [
    '20mm Coupler', '32mm Coupler', '63mm Coupler', '90mm Coupler', '125mm Coupler',
    '20mm Tee', '32mm Tee', '63mm Tee', '90mm Tee', '125mm Tee',
    '32mm Elbow', '63mm Elbow', '90mm Elbow', '125mm Elbow',
    '20mm End Cap', '32mm End Cap', '63mm End Cap', '90mm End Cap', '125mm End Cap',
    '32/20 Saddle', '63/20 Saddle', '63/32 Saddle', '90/63 Saddle', '125/63 Saddle',
    '32/20 Reducer', '63/32 Reducer', '90/63 Reducer', '125/90 Reducer',
    '½" T/F Fusion', '20mm PE Pipe',
  ],
  'MLC Fittings': [
    'MLC Pipe 12mm', 'MLC Clamp', 'MLC M Union', 'MLC F Union', 'MLC Clamp B Type', 'MLC Reamer',
  ],
};

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any) as any;

async function main() {
  console.log('='.repeat(70));
  console.log('SEEDING/UN-HIDING ALL DEFAULT MATERIALS IN NEON DB FOR ALL GAs');
  console.log('='.repeat(70));

  // 1. Get all active GA Locations from categories or sites
  const gaCategories = await prisma.stockCategory.findMany({
    where: { isHidden: false },
    include: { materials: true }
  });

  let createdCount = 0;
  let unhiddenCount = 0;
  let alreadyOkCount = 0;

  for (const cat of gaCategories) {
    const defaultMaterials = DEFAULT_MATERIALS_BY_CATEGORY[cat.name];
    if (!defaultMaterials) {
      console.log(`[GA="${cat.gaName}"] Category "${cat.name}" is custom, skipping default seeding.`);
      continue;
    }

    console.log(`\nProcessing GA="${cat.gaName}" | Category="${cat.name}" (id=${cat.id})`);

    const existingMap = new Map<string, any>();
    for (const m of cat.materials) {
      existingMap.set(m.name.trim().toLowerCase(), m);
    }

    for (const matName of defaultMaterials) {
      const normName = matName.trim().toLowerCase();
      const existing = existingMap.get(normName);

      if (!existing) {
        // Create new StockMaterial row in DB
        await prisma.stockMaterial.create({
          data: {
            name: matName,
            categoryId: cat.id,
            isHidden: false,
          }
        });
        createdCount++;
        console.log(`  ➕ CREATED  "${matName}"`);
      } else if (existing.isHidden) {
        // Un-hide existing row
        await prisma.stockMaterial.update({
          where: { id: existing.id },
          data: { isHidden: false }
        });
        unhiddenCount++;
        console.log(`  ✅ UNHID    "${matName}" (id=${existing.id})`);
      } else {
        alreadyOkCount++;
      }
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`SUMMARY: Created ${createdCount} new rows | Un-hidden ${unhiddenCount} rows | ${alreadyOkCount} already OK`);
  console.log('='.repeat(70));

  // Verification per GA
  const verCats = await prisma.stockCategory.findMany({
    where: { isHidden: false },
    include: { materials: { where: { isHidden: false } } },
    orderBy: [{ gaName: 'asc' }, { name: 'asc' }],
  });

  console.log('\nVERIFICATION: Active materials per category per GA:');
  for (const c of verCats) {
    console.log(`  GA "${c.gaName}" | Category "${c.name}": ${c.materials.length} active materials in DB`);
  }
}

main()
  .catch(e => { console.error('\n❌ Script failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
