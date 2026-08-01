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
    '20mm T/F \u00bd"', '32mm T/F 1"', '63mm T/F 2"', 'Warning Mate', 'Rubber Tube',
  ],
  'GI Fitting \u2014 \u00bd inch': [
    '\u00bd" GI Clamp', '\u00bd" GI Elbow', '\u00bd" GI Socket', '\u00bd" GI M/F Elbow',
    '\u00bd" GI Nipple 2"', '\u00bd" GI Nipple 3"', '\u00bd" GI Nipple 4"', '\u00bd" GI Nipple 5"', '\u00bd" GI Nipple 6"',
    'Meter Adaptor', 'Teflon Tape', '\u00bd" GI Tee', '\u00bd" T/F', '\u00bd" T/F Fusion',
    '\u00bd" Ball Valve (IV)', '\u00bd" Gas Tape (AV)', 'Rubber Tube Clamp', 'Anti Corrosive Tape', 'PVC Pipe 1"',
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

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any) as any;

async function runRecovery() {
  console.log('============================================================');
  console.log('STEP 1 — BEFORE STATE CONFIRMATION');
  console.log('============================================================');

  const beforeCount = await prisma.stockCategory.count();
  const sites = await prisma.site.findMany({ select: { id: true, name: true, gaName: true, location: true } });
  const gaNames: string[] = Array.from(new Set((sites as any[]).map((s: any) => s.gaName).filter(Boolean)));
  
  console.log(`Initial StockCategory count: ${beforeCount}`);
  console.log(`GA Locations found (${gaNames.length}):`, gaNames);

  console.log('\n============================================================');
  console.log('STEP 3 — EXECUTING DATA RESTORATION SCRIPT');
  console.log('============================================================');

  for (const gaName of gaNames) {
    console.log(`\nProcessing GA Location: "${gaName}"`);
    for (const catName of DEFAULT_CATEGORIES) {
      // Upsert StockCategory for this GA
      const cat = await prisma.stockCategory.upsert({
        where: { name_gaName: { name: catName, gaName } },
        update: { isHidden: false }, // unhide if previously marked hidden
        create: { name: catName, gaName, isDefault: true, isHidden: false },
      });

      console.log(`  ✓ Category [id=${cat.id}] "${catName}" (gaName="${gaName}") restored/active`);

      // Seed/unhide all default items for this category
      const defaultItems = DEFAULT_MATERIALS_BY_CATEGORY[catName] || [];
      const existingMaterials = await prisma.stockMaterial.findMany({ where: { categoryId: cat.id } });
      const existingMap = new Map((existingMaterials as any[]).map((m: any) => [m.name.trim().toLowerCase(), m]));

      for (const itemName of defaultItems) {
        const norm = itemName.trim().toLowerCase();
        const isPipe = norm.includes('pipe');
        const unit = isPipe ? 'mtr' : 'pcs';

        const existing = existingMap.get(norm);
        if (!existing) {
          await prisma.stockMaterial.create({
            data: { name: itemName, categoryId: cat.id, isHidden: false, unit },
          });
        } else if (existing.isHidden) {
          await prisma.stockMaterial.update({
            where: { id: existing.id },
            data: { isHidden: false, unit },
          });
        }
      }
    }
  }

  console.log('\n============================================================');
  console.log('STEP 4 — VERIFICATION OF RESTORED STATE');
  console.log('============================================================');

  const afterCount = await prisma.stockCategory.count({ where: { isHidden: false } });
  const allCategories = await prisma.stockCategory.findMany({
    where: { isHidden: false },
    orderBy: [{ gaName: 'asc' }, { name: 'asc' }],
    include: { materials: { where: { isHidden: false } } },
  });

  console.log(`Final Active StockCategory count: ${afterCount}`);
  console.log('\nRestored Categories and Materials per GA Location:\n');

  for (const c of (allCategories as any[])) {
    console.log(`GA: "${c.gaName}" | Category: "${c.name}" | Active Items: ${c.materials.length}`);
  }

  await prisma.$disconnect();
  await pool.end();
}

runRecovery().catch(console.error);
