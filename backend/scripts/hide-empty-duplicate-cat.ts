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
  // Hide empty duplicate category "GI Fitting - 1""
  const hidden = await prisma.stockCategory.updateMany({
    where: { name: 'GI Fitting - 1"' },
    data: { isHidden: true }
  });
  console.log(`Soft-deleted ${hidden.count} empty duplicate "GI Fitting - 1"" categories.`);
}

main().finally(async () => { await prisma.$disconnect(); await pool.end(); });
