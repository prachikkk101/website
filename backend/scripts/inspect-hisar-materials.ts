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
  const cats = await prisma.stockCategory.findMany({
    where: { gaName: 'Hisar' },
    include: { materials: true },
    orderBy: { name: 'asc' },
  });

  for (const c of cats) {
    console.log(`\n========================================`);
    console.log(`Category: "${c.name}" (id: ${c.id})`);
    console.log(`Materials total in DB: ${c.materials.length}`);
    const visible = c.materials.filter((m: any) => !m.isHidden);
    const hidden = c.materials.filter((m: any) => m.isHidden);
    console.log(`Visible (${visible.length}):`, visible.map((m: any) => m.name));
    console.log(`Hidden (${hidden.length}):`, hidden.map((m: any) => m.name));
  }
}

main().finally(async () => { await prisma.$disconnect(); await pool.end(); });
