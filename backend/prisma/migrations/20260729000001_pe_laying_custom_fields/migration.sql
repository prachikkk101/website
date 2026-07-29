-- Add customFields JSON column to PELaying table
-- Stores user-defined custom column values as { colKey: value }
ALTER TABLE "PELaying" ADD COLUMN IF NOT EXISTS "customFields" JSONB;
