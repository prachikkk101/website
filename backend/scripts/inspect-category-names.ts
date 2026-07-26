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
    include: { materials: true },
    orderBy: [{ gaName: 'asc' }, { name: 'asc' }],
  });

  for (const c of cats) {
    console.log(`GA: "${c.gaName}" | ID: ${c.id} | Name: "${c.name}" (len ${c.name.length}) | isHidden: ${c.isHidden}`);
    console.log(`   Char codes: ${Array.from(c.name).map((ch: any) => ch.charCodeAt(0)).join(',')}`);
    console.log(`   Materials count: ${c.materials.length} (visible: ${c.materials.filter((m: any) => !m.isHidden).length}, hidden: ${c.materials.filter((m: any) => m.isHidden).length})`);
    if (c.materials.length > 0) {
      console.log(`   Sample materials:`, c.materials.slice(0, 5).map((m: any) => `${m.name} (hidden:${m.isHidden})`));
    }
  }
}

main().finally(async () => { await prisma.$disconnect(); await pool.end(); });
