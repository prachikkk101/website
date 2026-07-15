/**
 * Step 0 Diagnostic Script — Run directly against Neon DB
 * Usage: cd backend && npx ts-node src/diag.ts
 */
import prisma from './config/db';

async function main() {
  console.log('\n========== STEP 0 DIAGNOSTIC ==========\n');

  /* 1 — Sites (these are the "GA Locations" in this codebase) */
  const sites = await prisma.site.findMany({
    select: { id: true, name: true, gaName: true, location: true, chargeArea: true, status: true },
    orderBy: { name: 'asc' },
  });
  console.log('── Site table ─────────────────────────');
  console.table(sites);

  /* 2 — Users */
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, emailVerified: true },
  });
  console.log('\n── User table ─────────────────────────');
  console.table(users);

  /* 3 — SiteUser (user-to-site assignments) */
  const siteUsers = await prisma.siteUser.findMany({
    include: {
      user: { select: { name: true, role: true } },
      site: { select: { name: true } },
    },
  });
  console.log('\n── SiteUser (assignments) ─────────────');
  siteUsers.forEach(su =>
    console.log(`  userId=${su.userId} (${su.user.name} / ${su.user.role}) → siteId=${su.siteId} (${su.site.name})`)
  );

  /* 4 — PNGConnection sample (first 20) */
  const pngs = await prisma.pNGConnection.findMany({
    take: 20,
    select: { id: true, siteId: true, customerName: true, status: true, photo1Data: true, photo2Data: true },
    orderBy: { createdAt: 'desc' },
  });
  console.log('\n── PNGConnection (last 20) ─────────────');
  pngs.forEach(p =>
    console.log(`  id=${p.id.slice(0,8)}  siteId=${p.siteId}  customer=${p.customerName}  status=${p.status}  photo1=${p.photo1Data ? (p.photo1Data.startsWith('http') ? '[R2 URL]' : '[base64]') : 'null'}  photo2=${p.photo2Data ? (p.photo2Data.startsWith('http') ? '[R2 URL]' : '[base64]') : 'null'}`)
  );
  console.log(`  Total PNG connections: ${await prisma.pNGConnection.count()}`);

  /* 5 — PELaying sample */
  const pelaying = await prisma.pELaying.findMany({
    take: 20,
    select: { id: true, siteId: true, area: true, dprPhotoUrl: true, d32oc: true, d63oc: true },
    orderBy: { createdAt: 'desc' },
  });
  console.log('\n── PELaying (last 20) ─────────────────');
  pelaying.forEach(p =>
    console.log(`  id=${p.id.slice(0,8)}  siteId=${p.siteId}  area=${p.area}  dprPhotoUrl=${p.dprPhotoUrl || 'null'}`)
  );
  console.log(`  Total PE Laying records: ${await prisma.pELaying.count()}`);

  /* 6 — InventoryItem sample */
  const inv = await prisma.inventoryItem.findMany({
    take: 20,
    select: { id: true, siteId: true, material: true, received: true, issued: true, inStore: true, challanPhotoUrl: true },
    orderBy: { updatedAt: 'desc' },
  });
  console.log('\n── InventoryItem (last 20) ────────────');
  console.table(inv.map(i => ({ ...i, id: i.id.slice(0, 8), siteId: i.siteId.slice(0, 8) })));

  /* 7 — PNG connections per site */
  console.log('\n── PNG connections per site ───────────');
  for (const site of sites) {
    const count = await prisma.pNGConnection.count({ where: { siteId: site.id } });
    console.log(`  ${site.name} (${site.id.slice(0, 8)}) → ${count} connections`);
  }

  /* 8 — PE Laying per site */
  console.log('\n── PELaying per site ──────────────────');
  for (const site of sites) {
    const count = await prisma.pELaying.count({ where: { siteId: site.id } });
    console.log(`  ${site.name} (${site.id.slice(0, 8)}) → ${count} PE records`);
  }

  console.log('\n========== DIAGNOSTIC COMPLETE ==========\n');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
