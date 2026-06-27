// @ts-ignore - Suppress IDE caching error, tsc compiles this perfectly
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

const extendedPrisma = prisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }: any) {
        const result = await query(args);
        
        if (['create', 'update', 'delete', 'upsert', 'createMany', 'updateMany', 'deleteMany'].includes(operation)) {
          if (model !== 'AuditLog') {
            try {
              // Extract a recordId if available
              let recordId = 'unknown';
              if (result && typeof result === 'object' && 'id' in result) {
                recordId = String((result as any).id);
              } else if ('where' in (args as any) && (args as any).where && 'id' in (args as any).where) {
                recordId = String(((args as any).where as any).id);
              }

              // Run the audit log creation detached so it doesn't block
              prisma.auditLog.create({
                data: {
                  tableName: model || 'Unknown',
                  recordId,
                  action: operation,
                  newValues: (args as any).data || (args as any).update || args || {},
                }
              }).catch((e: any) => console.error('Audit Log failed:', e));
            } catch (e: any) {
              console.error('Audit Log Error:', e);
            }
          }
        }
        
        return result;
      }
    }
  }
});

export default extendedPrisma;
