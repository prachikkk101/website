-- Migration: pe_laying_mdpe_materials
-- Adds mdpeMaterials JSONB column to PELaying to store MDPE fitting quantities used per entry.
-- Nullable so existing rows are unaffected.

ALTER TABLE "PELaying" ADD COLUMN IF NOT EXISTS "mdpeMaterials" JSONB;
