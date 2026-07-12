-- AddEnumValues: Expand PEStatus to include work-stage values used by the frontend
-- (TESTING = "Testing & Flushing", COMMISSIONING = "Commissioning")
-- NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction in PostgreSQL < 12.
-- Neon runs PostgreSQL 16, so this is safe.
ALTER TYPE "PEStatus" ADD VALUE IF NOT EXISTS 'TESTING';
ALTER TYPE "PEStatus" ADD VALUE IF NOT EXISTS 'COMMISSIONING';

-- AddColumn: Store connection type (Domestic/Commercial/Industrial) so tab grouping persists.
-- Previously this was incorrectly derived from the status field on the frontend,
-- causing all backend-loaded entries to disappear from the tab filter.
ALTER TABLE "PELaying" ADD COLUMN IF NOT EXISTS "connType" TEXT NOT NULL DEFAULT 'Domestic';
