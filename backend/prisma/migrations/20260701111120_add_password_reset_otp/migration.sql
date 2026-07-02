-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'SUPERVISOR', 'WORKER', 'VIEWER');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('DOMESTIC', 'COMMERCIAL', 'INDUSTRIAL', 'CNG');

-- CreateEnum
CREATE TYPE "PEStatus" AS ENUM ('LAYING', 'HDD', 'JOINT');

-- CreateEnum
CREATE TYPE "ICStatus" AS ENUM ('Done', 'Pending');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'WORKER',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationCode" TEXT,
    "verificationExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminWhitelist" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminWhitelist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "gaName" TEXT NOT NULL,
    "chargeArea" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "targetConns" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteUser" (
    "userId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "roleOverride" "Role",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteUser_pkey" PRIMARY KEY ("userId","siteId")
);

-- CreateTable
CREATE TABLE "MaterialItem" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "unit" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteStock" (
    "siteId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "openingQty" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "receivedQty" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "issuedQty" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "returnedQty" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "onSiteQty" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "inStoreQty" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "requiredQty" DECIMAL(10,3) NOT NULL DEFAULT 0,

    CONSTRAINT "SiteStock_pkey" PRIMARY KEY ("siteId","materialId")
);

-- CreateTable
CREATE TABLE "ConsumptionLog" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "locationDesc" TEXT NOT NULL,
    "workerName" TEXT NOT NULL,
    "quantities" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsumptionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PEReturnLog" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "bookRef" TEXT,
    "quantities" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PEReturnLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GIReturnLog" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "bookRef" TEXT,
    "quantities" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GIReturnLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryTransaction" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "qty" DECIMAL(10,3) NOT NULL,
    "date" DATE NOT NULL,
    "supplier" TEXT,
    "invoiceNo" TEXT,
    "loggedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PNGConnection" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "appNo" TEXT NOT NULL,
    "bpNo" TEXT,
    "accountType" "AccountType" NOT NULL DEFAULT 'DOMESTIC',
    "customerName" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "altMobile" TEXT,
    "houseNo" TEXT NOT NULL,
    "address1" TEXT NOT NULL,
    "address2" TEXT,
    "city" TEXT NOT NULL,
    "society" TEXT,
    "supervisorId" TEXT,
    "assignDateAgency" DATE,
    "assignDateSuper" DATE,
    "bpCreationDate" DATE,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "plumbingDate" DATE,
    "gcLength" DECIMAL(10,3),
    "giPipeMtr" DECIMAL(10,3),
    "tfCount" INTEGER DEFAULT 0,
    "ivCount" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PNGConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeterInstallation" (
    "id" TEXT NOT NULL,
    "pngConnectionId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "meterPhotoUrl" TEXT,
    "meterMake" TEXT NOT NULL,
    "serialNo" TEXT NOT NULL,
    "meterReading" DECIMAL(10,3) NOT NULL,
    "lhsRhs" TEXT NOT NULL,
    "installationDate" DATE NOT NULL,
    "installedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeterInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PELaying" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "layingDate" DATE NOT NULL,
    "testingDate" DATE,
    "chargingDate" DATE,
    "raBillNo" TEXT,
    "reportNo" TEXT,
    "status" "PEStatus" NOT NULL DEFAULT 'LAYING',
    "area" TEXT NOT NULL,
    "coilNo" TEXT NOT NULL,
    "d32oc" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "d32b" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "d63oc" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "d63b" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "d63hdd" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "d90tot" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "d125tot" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PELaying_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LMCWork" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "appNo" TEXT NOT NULL,
    "bpNo" TEXT,
    "customerName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "lmcDate" DATE,
    "regulatorNo" TEXT,
    "meterSerialNo" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LMCWork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ICWork" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "icDate" DATE,
    "regulatorPoutMbar" DECIMAL(10,2) NOT NULL,
    "flowRateScmh" DECIMAL(10,2) NOT NULL,
    "regulatorNo" TEXT,
    "meterSerialNo" TEXT,
    "status" "ICStatus" NOT NULL DEFAULT 'Pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ICWork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolReturn" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "dcNo" TEXT,
    "contractorName" TEXT NOT NULL,
    "quantities" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" TEXT NOT NULL,
    "markedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "tableName" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "oldValues" JSONB,
    "newValues" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeterRegister" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "serialNo" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "issuedToName" TEXT,
    "status" TEXT NOT NULL,
    "pngConnectionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeterRegister_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetOTP" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "otp" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetOTP_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AdminWhitelist_email_key" ON "AdminWhitelist"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Site_name_key" ON "Site"("name");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialItem_name_key" ON "MaterialItem"("name");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialItem_code_key" ON "MaterialItem"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PNGConnection_appNo_key" ON "PNGConnection"("appNo");

-- CreateIndex
CREATE UNIQUE INDEX "PNGConnection_bpNo_key" ON "PNGConnection"("bpNo");

-- CreateIndex
CREATE UNIQUE INDEX "MeterInstallation_pngConnectionId_key" ON "MeterInstallation"("pngConnectionId");

-- CreateIndex
CREATE UNIQUE INDEX "MeterInstallation_serialNo_key" ON "MeterInstallation"("serialNo");

-- CreateIndex
CREATE UNIQUE INDEX "LMCWork_appNo_key" ON "LMCWork"("appNo");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_userId_siteId_date_key" ON "Attendance"("userId", "siteId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "MeterRegister_serialNo_key" ON "MeterRegister"("serialNo");

-- CreateIndex
CREATE UNIQUE INDEX "MeterRegister_pngConnectionId_key" ON "MeterRegister"("pngConnectionId");

-- AddForeignKey
ALTER TABLE "SiteUser" ADD CONSTRAINT "SiteUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteUser" ADD CONSTRAINT "SiteUser_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteStock" ADD CONSTRAINT "SiteStock_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteStock" ADD CONSTRAINT "SiteStock_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "MaterialItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumptionLog" ADD CONSTRAINT "ConsumptionLog_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumptionLog" ADD CONSTRAINT "ConsumptionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PEReturnLog" ADD CONSTRAINT "PEReturnLog_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PEReturnLog" ADD CONSTRAINT "PEReturnLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GIReturnLog" ADD CONSTRAINT "GIReturnLog_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GIReturnLog" ADD CONSTRAINT "GIReturnLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "MaterialItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_loggedByUserId_fkey" FOREIGN KEY ("loggedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PNGConnection" ADD CONSTRAINT "PNGConnection_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PNGConnection" ADD CONSTRAINT "PNGConnection_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeterInstallation" ADD CONSTRAINT "MeterInstallation_pngConnectionId_fkey" FOREIGN KEY ("pngConnectionId") REFERENCES "PNGConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeterInstallation" ADD CONSTRAINT "MeterInstallation_installedByUserId_fkey" FOREIGN KEY ("installedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PELaying" ADD CONSTRAINT "PELaying_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LMCWork" ADD CONSTRAINT "LMCWork_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ICWork" ADD CONSTRAINT "ICWork_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolReturn" ADD CONSTRAINT "ToolReturn_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_markedByUserId_fkey" FOREIGN KEY ("markedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeterRegister" ADD CONSTRAINT "MeterRegister_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeterRegister" ADD CONSTRAINT "MeterRegister_pngConnectionId_fkey" FOREIGN KEY ("pngConnectionId") REFERENCES "PNGConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
