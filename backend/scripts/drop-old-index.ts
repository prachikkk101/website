import dotenv from 'dotenv';
// @ts-ignore
import { Pool } from 'pg';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    console.log('Dropping old unique index "StockCategory_name_key"...');
    await client.query('DROP INDEX IF EXISTS "StockCategory_name_key";');
    console.log('✅ Done.');

    // Verify
    const idxRes = await client.query(`
      SELECT indexname FROM pg_indexes WHERE tablename = 'StockCategory' ORDER BY indexname;
    `);
    console.log('Remaining indexes on StockCategory:');
    for (const row of idxRes.rows) console.log(`  ${row.indexname}`);
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch(e => { console.error(e); process.exit(1); });
