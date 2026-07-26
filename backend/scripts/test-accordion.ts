import dotenv from 'dotenv';
// @ts-ignore
import { PrismaClient } from '@prisma/client';
// @ts-ignore
import { PrismaPg } from '@prisma/adapter-pg';
// @ts-ignore
import { Pool } from 'pg';

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

function buildAccordionCategories(cats: any[], stockItems: any[] | null = null) {
  const normalize = (s: string) => (s || '').toLowerCase().trim();

  return cats.map((c, i) => {
    const defaultItems = DEFAULT_MATERIALS_BY_CATEGORY[c.name] || [];
    const hiddenSet = new Set((c.hiddenDefaults || []).map(normalize));
    const dbMaterials = (c.materials || []);
    const dbByName = Object.fromEntries(dbMaterials.map((m: any) => [normalize(m.name), m.id]));
    const visibleDefaults = defaultItems.filter(name => !hiddenSet.has(normalize(name)));
    const visibleDefaultNorm = visibleDefaults.map(normalize);
    const extraDbMaterials = dbMaterials.filter((m: any) => !visibleDefaultNorm.includes(normalize(m.name)));
    const richItems = [
      ...visibleDefaults.map(name => ({ name, dbId: dbByName[normalize(name)] ?? null })),
      ...extraDbMaterials.map((m: any) => ({ name: m.name, dbId: m.id })),
    ];
    return {
      id: String(c.id),
      label: c.name,
      items: richItems.map(r => r.name),
      matItems: richItems,
    };
  });
}


dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any) as any;

async function main() {
  const dbCats = await prisma.stockCategory.findMany({
    where: { gaName: 'Hisar' },
    include: { materials: { where: { isHidden: false } } },
    orderBy: { name: 'asc' },
  });

  // Format as API response:
  const apiCats = dbCats.map((dbCat: any) => ({
    id: dbCat.id,
    name: dbCat.name,
    materials: dbCat.materials.map((m: any) => ({ id: m.id, name: m.name })),
    hiddenDefaults: [],
  }));

  const built = buildAccordionCategories(apiCats);

  for (const cat of built) {
    console.log(`\nCategory: "${cat.label}" (id: ${cat.id})`);
    console.log(`  Items count: ${cat.items.length}`);
    if (cat.items.length > 0) {
      console.log(`  First 3 items:`, cat.items.slice(0, 3));
    }
  }
}

main().finally(async () => { await prisma.$disconnect(); await pool.end(); });
