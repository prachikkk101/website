-- Add photo fields to PNGConnection so that house photos persist across sessions.
-- Previously, photo1Data/photo2Data were stored only in React local state and were
-- lost on every page refresh. These TEXT fields hold base64 data URLs (≤4MB enforced
-- by frontend validation before conversion).
ALTER TABLE "PNGConnection"
  ADD COLUMN IF NOT EXISTS "photo1Data" TEXT,
  ADD COLUMN IF NOT EXISTS "photo2Data" TEXT;

-- Add columnConfig to Site so that custom column definitions and visibility
-- preferences are shared across all users viewing the same site, instead of
-- being stored in each browser's localStorage (per-device only).
-- JSON structure: { "house": { "customCols": [...], "hiddenCols": [...] }, "pelaying": {...} }
ALTER TABLE "Site"
  ADD COLUMN IF NOT EXISTS "columnConfig" JSONB DEFAULT '{}';
