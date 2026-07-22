import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Step 1 diagnostics
  const gas = await prisma.gaLocation.findMany({
    where: { name: { contains: 'Hisar', mode: 'insensitive' } }
  });
  console.log('\n=== GaLocations matching Hisar ===');
  console.log(JSON.stringify(gas, null, 2));

  const cities = await prisma.city.findMany({
    where: {
      OR: [
        { name: { contains: 'Hisar', mode: 'insensitive' } },
        { name: { contains: 'PLA', mode: 'insensitive' } },
        { name: { contains: 'UE', mode: 'insensitive' } },
        { name: { contains: 'Urban', mode: 'insensitive' } },
      ]
    }
  });
  console.log('\n=== Cities matching Hisar/PLA/UE/Urban ===');
  console.log(JSON.stringify(cities, null, 2));

  const areas = await prisma.area.findMany({
    where: {
      OR: [
        { name: { contains: 'PLA', mode: 'insensitive' } },
        { name: { contains: 'UE', mode: 'insensitive' } },
        { name: { contains: 'Urban', mode: 'insensitive' } },
        { name: { contains: 'Hisar', mode: 'insensitive' } },
      ]
    }
  });
  console.log('\n=== Areas matching PLA/UE/Urban/Hisar ===');
  console.log(JSON.stringify(areas, null, 2));

  // Also print ALL GaLocations, Cities, Areas for full picture
  const allGA = await prisma.gaLocation.findMany();
  console.log('\n=== ALL GaLocations ===');
  console.log(JSON.stringify(allGA, null, 2));

  const allCities = await prisma.city.findMany();
  console.log('\n=== ALL Cities ===');
  console.log(JSON.stringify(allCities, null, 2));

  const allAreas = await prisma.area.findMany();
  console.log('\n=== ALL Areas ===');
  console.log(JSON.stringify(allAreas, null, 2));

  // Also check Sites
  const allSites = await prisma.site.findMany();
  console.log('\n=== ALL Sites ===');
  console.log(JSON.stringify(allSites, null, 2));

  // SiteUser assignments
  const siteUsers = await prisma.siteUser.findMany({ include: { user: { select: { name: true, email: true } }, site: true } });
  console.log('\n=== SiteUser assignments ===');
  console.log(JSON.stringify(siteUsers, null, 2));
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
