-- Migration: scope_stock_categories_to_ga
-- Adds gaName field to StockCategory so categories are scoped per GA Location.
-- After this migration, run the backfill script to duplicate each category per GA.

-- 1. Drop the old single-column unique constraint on name
ALTER TABLE "StockCategory" DROP CONSTRAINT IF EXISTS "StockCategory_name_key";

-- 2. Add gaName column (NOT NULL DEFAULT '' lets existing rows stay valid before backfill)
ALTER TABLE "StockCategory" ADD COLUMN "gaName" TEXT NOT NULL DEFAULT '';

-- 3. Create composite unique index (name + gaName)
CREATE UNIQUE INDEX "StockCategory_name_gaName_key" ON "StockCategory"("name", "gaName");
