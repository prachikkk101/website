import prisma from './config/db';

async function run() {
  try {
    const items = await prisma.inventoryItem.findMany();
    console.log('All InventoryItems:', JSON.stringify(items, null, 2));
    const connections = await prisma.pNGConnection.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    console.log('Recent PNG Connections:', JSON.stringify(connections, null, 2));
  } catch (err: any) {
    console.error('Error:', err.message, err);
  } finally {
    process.exit(0);
  }
}

run();
