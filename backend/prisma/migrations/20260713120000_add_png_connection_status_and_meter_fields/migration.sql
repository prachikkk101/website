-- AddColumns: Add missing GI/RFC/NG status fields and meter number/date to PNGConnection.
-- These fields were present in the frontend form but had no DB columns, so they were
-- silently dropped on every save (Zod strips unknown fields) and hardcoded as '—' on load.
-- This migration adds the columns without affecting any existing data.
ALTER TABLE "PNGConnection"
  ADD COLUMN IF NOT EXISTS "giStatus"  TEXT,
  ADD COLUMN IF NOT EXISTS "rfcStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "ngStatus"  TEXT,
  ADD COLUMN IF NOT EXISTS "meterNo"   TEXT,
  ADD COLUMN IF NOT EXISTS "meterDate" DATE;
