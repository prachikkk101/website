// WARNING: Never run broad deletes (deleteMany without highly specific unique
// where clauses) against production data. Always verify exact record IDs before
// deleting. Do NOT delete all records matching a site/pattern — only target
// specific known IDs (e.g. exact user email, exact SiteStock id).
// This seed file clears ALL data (safe for dev/staging only) — never run on prod.
import { PrismaClient, Role } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import * as bcrypt from 'bcryptjs';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  // 1. Clean existing data
  await prisma.auditLog.deleteMany({});
  await prisma.attendance.deleteMany({});
  await prisma.toolReturn.deleteMany({});
  await prisma.iCWork.deleteMany({});
  await prisma.lMCWork.deleteMany({});
  await prisma.meterInstallation.deleteMany({});
  await prisma.pNGConnection.deleteMany({});
  await prisma.pELaying.deleteMany({});
  await prisma.siteStock.deleteMany({});
  await prisma.inventoryTransaction.deleteMany({});
  await prisma.consumptionLog.deleteMany({});
  await prisma.pEReturnLog.deleteMany({});
  await prisma.gIReturnLog.deleteMany({});
  await prisma.materialItem.deleteMany({});
  await prisma.siteUser.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.adminWhitelist.deleteMany({});

  // 2. Seed Admin Whitelist
  const whitelistEmails = [
    'oxygenprotech@gmail.com',
    'radhe.sangwan1980@gmail.com',
  ];
  for (const email of whitelistEmails) {
    await prisma.adminWhitelist.create({ data: { email } });
  }
  console.log('Seeded Admin Whitelist');

  // 3. Seed Admin Users ONLY — no dummy supervisors/workers
  const salt = await bcrypt.genSalt(10);
  const adminPasswordHash = await bcrypt.hash('OxygenAdmin@2026', salt);

  await prisma.user.create({
    data: {
      email: 'oxygenprotech@gmail.com',
      name: 'Oxygen Protech Admin',
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
      emailVerified: true,
    },
  });

  await prisma.user.create({
    data: {
      email: 'radhe.sangwan1980@gmail.com',
      name: 'Radhe Sangwan',
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
      emailVerified: true,
    },
  });

  console.log('Seeded Admin Users: oxygenprotech@gmail.com, radhe.sangwan1980@gmail.com');

  // 4. Seed Sites (GA Locations)
  const sites = [
    {
      name: 'Khanna — CA-09',
      location: 'Zone-02, Ludhiana',
      gaName: 'AG&P',
      chargeArea: 'Khanna',
      zone: 'Zone-2',
      district: 'Ludhiana',
      status: 'Active',
      targetConns: 1350,
    },
    {
      name: 'UE-II — Hisar',
      location: 'Urban Extension II',
      gaName: 'HCG',
      chargeArea: 'UE-II',
      zone: 'Sector 14',
      district: 'Hisar',
      status: 'Active',
      targetConns: 1100,
    },
    {
      name: 'PLA — Hisar',
      location: 'P.L.A Colony',
      gaName: 'HCG',
      chargeArea: 'PLA',
      zone: 'Colony Area',
      district: 'Hisar',
      status: 'Active',
      targetConns: 900,
    },
    {
      name: 'Kohara — CA-07',
      location: 'Kohara, Ludhiana',
      gaName: 'AG&P',
      chargeArea: 'Kohara',
      zone: 'Zone-1',
      district: 'Ludhiana',
      status: 'Active',
      targetConns: 980,
    },
  ];

  for (const s of sites) {
    await prisma.site.create({ data: s });
  }
  console.log('Seeded Sites');

  // NOTE: No dummy SiteStock, PNGConnections, PELaying, ICWork, or test users are seeded.
  // All operational data should be entered through the application UI.
  console.log('Seeding completed successfully! (clean seed — admins + sites only)');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
