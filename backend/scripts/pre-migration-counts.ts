import 'dotenv/config';
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
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const [cats, matCount, sites] = await Promise.all([
    (prisma as any).stockCategory.findMany({ include: { materials: { select: { id: true, name: true, isHidden: true } } }, orderBy: { id: 'asc' } }),
    (prisma as any).stockMaterial.count(),
    (prisma as any).site.findMany({ where: { status: 'Active' }, select: { gaName: true } }),
  ]);

  const gaNames = [...new Set((sites as any[]).map((s: any) => s.gaName).filter(Boolean))] as string[];

  console.log('\n══════════════════════════════════════════════════');
  console.log('PRE-MIGRATION SNAPSHOT');
  console.log('══════════════════════════════════════════════════');
  console.log(`StockCategory rows : ${(cats as any[]).length}`);
  console.log(`StockMaterial rows : ${matCount}`);
  console.log(`Unique GA Locations: ${gaNames.length}`);
  console.log(`GA Names           : ${gaNames.join(', ')}`);
  console.log('');
  console.log('Expected post-backfill:');
  console.log(`  Categories : ${(cats as any[]).length} × ${gaNames.length} = ${(cats as any[]).length * gaNames.length} rows`);
  console.log(`  Materials  : ${matCount} × ${gaNames.length} = ${(matCount as number) * gaNames.length} rows (approx)`);
  console.log('');
  console.log('── Category Details ─────────────────────────────');
  for (const c of (cats as any[])) {
    const vis = (c.materials as any[]).filter((m: any) => !m.isHidden).length;
    console.log(`  [id=${c.id}] "${c.name}" | isHidden=${c.isHidden} | totalMats=${(c.materials as any[]).length} visibleMats=${vis}`);
  }
  console.log('══════════════════════════════════════════════════\n');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await (prisma as any).$disconnect(); await pool.end(); });
