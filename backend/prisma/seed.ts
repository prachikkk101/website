import { PrismaClient, Role, AccountType, PEStatus, ICStatus } from '@prisma/client';
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
    'radhe.sangwan1980@gmail.com'
  ];
  for (const email of whitelistEmails) {
    await prisma.adminWhitelist.create({ data: { email } });
  }
  console.log('Seeded Admin Whitelist');

  // 3. Seed Users
  const salt = await bcrypt.genSalt(10);
  const adminPasswordHash = await bcrypt.hash('OxygenAdmin@2026', salt);
  const workerPasswordHash = await bcrypt.hash('worker123', salt);

  const admin1 = await prisma.user.create({
    data: {
      email: 'oxygenprotech@gmail.com',
      name: 'Oxygen Protech Admin',
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
      emailVerified: true,
    },
  });

  const admin2 = await prisma.user.create({
    data: {
      email: 'radhe.sangwan1980@gmail.com',
      name: 'Radhe Sangwan',
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
      emailVerified: true,
    },
  });

  const supervisor = await prisma.user.create({
    data: {
      email: 'super@gppms.com',
      name: 'Ravi Sharma',
      passwordHash: workerPasswordHash,
      role: Role.SUPERVISOR,
      emailVerified: true,
    },
  });

  const worker = await prisma.user.create({
    data: {
      email: 'worker@gppms.com',
      name: 'Gurpreet Singh',
      passwordHash: workerPasswordHash,
      role: Role.WORKER,
      emailVerified: true,
    },
  });
  console.log('Seeded Users: oxygenprotech@gmail.com, radhe.sangwan1980@gmail.com, super@gppms.com, worker@gppms.com');

  // 4. Seed Sites
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
      status: 'Low Stock',
      targetConns: 980,
    },
  ];

  const seededSites = [];
  for (const s of sites) {
    const site = await prisma.site.create({ data: s });
    seededSites.push(site);
  }
  console.log('Seeded Sites');

  // Assign supervisor & worker to Khanna site
  await prisma.siteUser.create({
    data: {
      userId: supervisor.id,
      siteId: seededSites[0].id,
    },
  });
  await prisma.siteUser.create({
    data: {
      userId: worker.id,
      siteId: seededSites[0].id,
    },
  });

  // 5. Seed Material Catalog
  const materials = [
    // PE materials
    { category: 'PE', name: '20mm PE Pipe', code: 'PE-20', unit: 'Mtr' },
    { category: 'PE', name: '25mm MDPE Pipe', code: 'PE-25', unit: 'Mtr' },
    { category: 'PE', name: '32mm PE Pipe', code: 'PE-32', unit: 'Mtr' },
    { category: 'PE', name: '63mm MDPE Pipe', code: 'PE-63', unit: 'Mtr' },
    { category: 'PE', name: '90mm MDPE Pipe', code: 'PE-90', unit: 'Mtr' },
    { category: 'PE', name: '125mm MDPE Pipe', code: 'PE-125', unit: 'Mtr' },
    { category: 'PE', name: '20mm Coupler', code: 'PE-C-20', unit: 'Pcs' },
    { category: 'PE', name: '32mm Coupler', code: 'PE-C-32', unit: 'Pcs' },
    { category: 'PE', name: '63mm Coupler', code: 'PE-C-63', unit: 'Pcs' },
    { category: 'PE', name: '125mm Elbow', code: 'PE-E-125', unit: 'Pcs' },
    { category: 'PE', name: 'Tee 32mm', code: 'PE-T-32', unit: 'Pcs' },
    { category: 'PE', name: 'Reducer 32x25mm', code: 'PE-R-32-25', unit: 'Pcs' },
    { category: 'PE', name: 'PE Saddle 63x25mm', code: 'PE-S-63-25', unit: 'Pcs' },
    
    // GI materials
    { category: 'GI', name: '½\'\' GI Pipe', code: 'GI-PIPE-0.5', unit: 'Mtr' },
    { category: 'GI', name: '½\'\' GI Elbow', code: 'GI-ELB-0.5', unit: 'Pcs' },
    { category: 'GI', name: '½\'\' GI Tee', code: 'GI-TEE-0.5', unit: 'Pcs' },
    { category: 'GI', name: 'GI Nipple 25mm', code: 'GI-NIP-25', unit: 'Pcs' },
    { category: 'GI', name: 'Compression Fitting 25mm', code: 'COMP-FIT-25', unit: 'Pcs' },
    { category: 'GI', name: 'Pressure Regulator', code: 'PRESS-REG', unit: 'Pcs' },
    { category: 'GI', name: 'Gas Hose Pipe (1mtr)', code: 'GAS-HOSE-1', unit: 'Pcs' },
    { category: 'GI', name: 'Isolation Valve 63mm', code: 'ISO-VAL-63', code2: 'ISO-63', unit: 'Pcs' } as any,
    { category: 'GI', name: 'Ball Valve 25mm', code: 'BALL-VAL-25', unit: 'Pcs' },

    // Meter materials
    { category: 'METER', name: 'Meter Set (Domestic)', code: 'MTR-DOM', unit: 'Set' },
  ];

  const seededMaterials = [];
  for (const m of materials) {
    const { code2, ...cleanM } = m as any;
    const mat = await prisma.materialItem.create({ data: cleanM });
    seededMaterials.push(mat);
  }
  console.log('Seeded Materials Catalog');

  // 6. Seed Site Stocks (For Khanna — CA-09)
  const khanna = seededSites[0];
  const stocksData = [
    { name: '25mm MDPE Pipe', open: 1500, recv: 800, issued: 1200, ret: 50, site: 620, store: 530, req: 1000 },
    { name: '32mm PE Pipe', open: 600, recv: 200, issued: 756, ret: 12, site: 12, store: 44, req: 400 },
    { name: '63mm MDPE Pipe', open: 400, recv: 300, issued: 420, ret: 20, site: 250, store: 110, req: 200 },
    { name: '90mm MDPE Pipe', open: 200, recv: 100, issued: 180, ret: 10, site: 110, store: 20, req: 150 },
    { name: '125mm Elbow', open: 50, recv: 20, issued: 64, ret: 2, site: 3, store: 5, req: 40 },
    { name: 'Ball Valve 25mm', open: 300, recv: 150, issued: 280, ret: 15, site: 140, store: 45, req: 200 },
    { name: 'Meter Set (Domestic)', open: 500, recv: 200, issued: 380, ret: 5, site: 280, store: 45, req: 300 },
    { name: 'Tee 32mm', open: 120, recv: 80, issued: 95, ret: 8, site: 90, store: 23, req: 60 },
    { name: 'Reducer 32x25mm', open: 200, recv: 100, issued: 210, ret: 12, site: 72, store: 30, req: 100 },
    { name: 'PE Saddle 63x25mm', open: 250, recv: 100, issued: 280, ret: 8, site: 55, store: 23, req: 120 },
    { name: 'GI Nipple 25mm', open: 400, recv: 200, issued: 350, ret: 20, site: 210, store: 60, req: 200 },
    { name: 'Compression Fitting 25mm', open: 180, recv: 90, issued: 200, ret: 10, site: 45, store: 25, req: 100 },
    { name: 'Pressure Regulator', open: 60, recv: 40, issued: 55, ret: 3, site: 37, store: 5, req: 30 },
    { name: 'Gas Hose Pipe (1mtr)', open: 300, recv: 100, issued: 260, ret: 5, site: 110, store: 25, req: 150 },
    { name: 'Isolation Valve 63mm', open: 80, recv: 40, issued: 75, ret: 5, site: 40, store: 10, req: 40 },
  ];

  for (const sd of stocksData) {
    const mat = seededMaterials.find(m => m.name === sd.name);
    if (mat) {
      await prisma.siteStock.create({
        data: {
          siteId: khanna.id,
          materialId: mat.id,
          openingQty: sd.open,
          receivedQty: sd.recv,
          issuedQty: sd.issued,
          returnedQty: sd.ret,
          onSiteQty: sd.site,
          inStoreQty: sd.store,
          requiredQty: sd.req,
        },
      });
    }
  }
  console.log('Seeded Initial Stock Levels for Khanna site');

  // 7. Seed House Connections (PNG Connections)
  const pngConnections = [
    {
      appNo: '110910001360',
      bpNo: '1700053531',
      accountType: AccountType.DOMESTIC,
      customerName: 'Manoj Gupta',
      mobile: '9416729513',
      houseNo: '513 GF PLA',
      address1: 'PLA Colony, Hisar',
      city: 'HISAR',
      society: 'PLA Colony',
      status: 'Done',
      plumbingDate: new Date('2026-04-20'),
      gcLength: 12.5,
      giPipeMtr: 6.0,
      tfCount: 1,
      ivCount: 1,
    },
    {
      appNo: '110910001361',
      bpNo: '1700052235',
      accountType: AccountType.DOMESTIC,
      customerName: 'Pushpa Devi',
      mobile: '9812001122',
      houseNo: '153 GF1',
      address1: 'PLA Colony, Hisar',
      city: 'HISAR',
      society: 'PLA Colony',
      status: 'RFC',
      plumbingDate: new Date('2026-06-01'),
      gcLength: 8.0,
      giPipeMtr: 4.5,
      tfCount: 1,
      ivCount: 1,
    },
    {
      appNo: '110910001362',
      bpNo: '1700064287',
      accountType: AccountType.DOMESTIC,
      customerName: 'Parvesh Berwal',
      mobile: '9876500111',
      houseNo: '292 FF',
      address1: 'Urban Extension II, Hisar',
      city: 'HISAR',
      society: 'Urban Extension II',
      status: 'Pending',
      plumbingDate: null,
      gcLength: 0,
      giPipeMtr: 0,
      tfCount: 0,
      ivCount: 0,
    },
  ];

  for (const conn of pngConnections) {
    const png = await prisma.pNGConnection.create({
      data: {
        siteId: khanna.id,
        supervisorId: supervisor.id,
        ...conn,
      },
    });

    // If connection status is done, seed its meter installation
    if (conn.status === 'Done') {
      await prisma.meterInstallation.create({
        data: {
          pngConnectionId: png.id,
          siteId: khanna.id,
          meterMake: 'Itron',
          serialNo: '20240321327',
          meterReading: 0.1,
          lhsRhs: 'LHS',
          installationDate: new Date('2026-04-20'),
          installedByUserId: supervisor.id,
        },
      });
    }
  }
  console.log('Seeded PNG Connections & Meters');

  // 8. Seed PE Laying Records
  const peLayingData = [
    {
      layingDate: new Date('2022-08-07'),
      testingDate: new Date('2022-10-13'),
      chargingDate: new Date('2022-10-22'),
      raBillNo: 'RA Bill No.1',
      reportNo: '1',
      status: PEStatus.LAYING,
      area: 'Kishangar Village',
      coilNo: '96-2220607041',
      d32oc: 12.0,
      d32b: 85.0,
    },
    {
      layingDate: new Date('2022-08-08'),
      testingDate: new Date('2022-10-13'),
      chargingDate: new Date('2022-10-22'),
      raBillNo: 'RA Bill No.1',
      reportNo: '2',
      status: PEStatus.LAYING,
      area: 'Kishangar Village',
      coilNo: '143-2220606042',
      d32oc: 6.0,
      d32b: 38.0,
    },
    {
      layingDate: new Date('2022-08-17'),
      testingDate: new Date('2022-09-15'),
      chargingDate: new Date('2022-10-11'),
      raBillNo: 'RA Bill No.7',
      reportNo: '8A',
      status: PEStatus.HDD,
      area: 'Celebration Mall',
      coilNo: '686-22112210038',
      d63hdd: 107.0,
    },
  ];

  for (const pe of peLayingData) {
    await prisma.pELaying.create({
      data: {
        siteId: khanna.id,
        ...pe,
      },
    });
  }
  console.log('Seeded PE Laying Records');

  // 9. Seed IC Work Records (Installation & Commissioning)
  const icWorkData = [
    {
      customerName: 'Elegance Banquet & Restaurant',
      address: 'Model Town, Khanna',
      icDate: new Date('2026-03-15'),
      regulatorPoutMbar: 300,
      flowRateScmh: 25,
      regulatorNo: '1122/M09725',
      meterSerialNo: 'Q0729812',
      status: ICStatus.Done,
    },
    {
      customerName: 'Punjab Sweet House',
      address: 'Sector 12, Khanna',
      icDate: new Date('2026-03-20'),
      regulatorPoutMbar: 250,
      flowRateScmh: 16,
      regulatorNo: '1122/M09731',
      meterSerialNo: 'Q0729819',
      status: ICStatus.Done,
    },
    {
      customerName: 'Rainbow Public School',
      address: 'UE-II, Hisar',
      icDate: null,
      regulatorPoutMbar: 300,
      flowRateScmh: 25,
      regulatorNo: null,
      meterSerialNo: null,
      status: ICStatus.Pending,
    },
  ];

  for (const ic of icWorkData) {
    await prisma.iCWork.create({
      data: {
        siteId: khanna.id,
        ...ic,
      },
    });
  }
  console.log('Seeded IC Work Records');

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
