import dotenv from 'dotenv';
// @ts-ignore
import { PrismaPg } from '@prisma/adapter-pg';
// @ts-ignore
import { Pool } from 'pg';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT conname, contype, pg_get_constraintdef(oid) as def
      FROM pg_constraint
      WHERE conrelid = '"StockCategory"'::regclass
      ORDER BY contype;
    `);
    console.log('Constraints on StockCategory:');
    for (const row of res.rows) {
      console.log(`  ${row.conname} (type=${row.contype}): ${row.def}`);
    }

    const idxRes = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'StockCategory'
      ORDER BY indexname;
    `);
    console.log('\nIndexes on StockCategory:');
    for (const row of idxRes.rows) {
      console.log(`  ${row.indexname}: ${row.indexdef}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch(e => { console.error(e); process.exit(1); });
