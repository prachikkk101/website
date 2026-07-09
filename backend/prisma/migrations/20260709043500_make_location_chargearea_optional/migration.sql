-- AlterTable: make location and chargeArea nullable on Site
ALTER TABLE "Site" ALTER COLUMN "location" DROP NOT NULL;
ALTER TABLE "Site" ALTER COLUMN "chargeArea" DROP NOT NULL;
