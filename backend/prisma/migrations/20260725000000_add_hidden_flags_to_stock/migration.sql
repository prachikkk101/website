-- AddColumn: isHidden to StockCategory (soft-delete for admin-managed category deletion)
ALTER TABLE "StockCategory" ADD COLUMN "isHidden" BOOLEAN NOT NULL DEFAULT false;

-- AddColumn: isHidden to StockMaterial (soft-delete for seeded default item deletion)
ALTER TABLE "StockMaterial" ADD COLUMN "isHidden" BOOLEAN NOT NULL DEFAULT false;
