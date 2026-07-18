import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import { z } from 'zod';
import prisma from '../config/db';
import { Role } from '@prisma/client';

export const getSites = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    let sites;
    if (req.user.role === Role.ADMIN) {
      // Admins can see all sites
      sites = await prisma.site.findMany({
        include: {
          users: {
            include: {
              user: {
                select: { id: true, name: true, email: true, role: true },
              },
            },
          },
        },
      });
    } else {
      // Others see only assigned sites
      const assignments = await prisma.siteUser.findMany({
        where: { userId: req.user.id },
        include: {
          site: {
            include: {
              users: {
                include: {
                  user: {
                    select: { id: true, name: true, email: true, role: true },
                  },
                },
              },
            },
          },
        },
      });
      sites = assignments.map(a => a.site);
    }

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.status(200).json({ success: true, sites });
  } catch (error) {
    next(error);
  }
};

export const createSite = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const schema = z.object({
    name: z.string().min(1),
    location: z.string().optional(),
    gaName: z.string().min(1),
    chargeArea: z.string().optional(),
    zone: z.string().min(1),
    district: z.string().min(1),
    targetConns: z.number().int().nonnegative().optional(),
  });

  try {
    const data = schema.parse(req.body);
    const existing = await prisma.site.findUnique({ where: { name: data.name } });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Site name already exists' });
    }

    const site = await prisma.site.create({ data });

    // Automatically instantiate site_stock for all materials in one batch insert
    const materials = await prisma.materialItem.findMany();
    if (materials.length > 0) {
      await prisma.siteStock.createMany({
        data: materials.map(mat => ({
          siteId: site.id,
          materialId: mat.id,
          openingQty: 0,
          receivedQty: 0,
          issuedQty: 0,
          returnedQty: 0,
          onSiteQty: 0,
          inStoreQty: 0,
          requiredQty: 0,
        })),
        skipDuplicates: true,
      });
    }

    res.status(201).json({ success: true, site });
  } catch (error) {
    next(error);
  }
};

export const getSiteById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const site = await prisma.site.findUnique({
      where: { id: req.params.id as string },
      include: {
        users: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
      },
    });

    if (!site) {
      return res.status(404).json({ success: false, error: 'Site not found' });
    }

    // Compute site stats for the summary/overview
    const connsCount = await prisma.pNGConnection.count({ where: { siteId: site.id } });
    const doneConnsCount = await prisma.pNGConnection.count({
      where: { siteId: site.id, status: 'Done' },
    });
    const rfcCount = await prisma.pNGConnection.count({
      where: { siteId: site.id, status: 'RFC' },
    });
    const metersCount = await prisma.meterInstallation.count({ where: { siteId: site.id } });

    res.status(200).json({
      success: true,
      site,
      stats: {
        totalConnections: connsCount,
        doneConnections: doneConnsCount,
        rfcConnections: rfcCount,
        metersInstalled: metersCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const assignWorker = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const schema = z.object({
    userId: z.string().uuid(),
    roleOverride: z.nativeEnum(Role).optional(),
  });

  try {
    const { userId, roleOverride } = schema.parse(req.body);
    const siteId = req.params.id as string;

    // Check user & site existence
    const userExists = await prisma.user.findUnique({ where: { id: userId } });
    if (!userExists) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    const siteExists = await prisma.site.findUnique({ where: { id: siteId } });
    if (!siteExists) {
      return res.status(404).json({ success: false, error: 'Site not found' });
    }

    const mapping = await prisma.siteUser.upsert({
      where: {
        userId_siteId: { userId, siteId },
      },
      update: { roleOverride },
      create: { userId, siteId, roleOverride },
    });

    res.status(200).json({ success: true, mapping });
  } catch (error) {
    next(error);
  }
};

export const getSiteStock = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const siteId = req.params.id as string;
    const stock = await prisma.siteStock.findMany({
      where: { siteId },
      include: {
        material: true,
      },
    });

    res.status(200).json({ success: true, stock });
  } catch (error) {
    next(error);
  }
};

export const receiveStock = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const schema = z.object({
    materialId: z.string().uuid(),
    qty: z.number().positive(),
    supplier: z.string().optional(),
    invoiceNo: z.string().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  });

  try {
    const siteId = req.params.id as string;
    const data = schema.parse(req.body);

    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Verify material exists
    const material = await prisma.materialItem.findUnique({ where: { id: data.materialId } });
    if (!material) {
      return res.status(404).json({ success: false, error: 'Material not found' });
    }

    const transaction = await prisma.$transaction(async (tx) => {
      // 1. Create transaction log
      const txn = await tx.inventoryTransaction.create({
        data: {
          siteId,
          materialId: data.materialId,
          transactionType: 'RECEIVE',
          qty: data.qty,
          date: new Date(data.date),
          supplier: data.supplier,
          invoiceNo: data.invoiceNo,
          loggedByUserId: req.user!.id,
        },
      });

      // 2. Upsert Received and Store quantities in site_stock
      const updatedStock = await tx.siteStock.upsert({
        where: { siteId_materialId: { siteId, materialId: data.materialId } },
        create: {
          siteId,
          materialId: data.materialId,
          receivedQty: data.qty,
          inStoreQty: data.qty,
        },
        update: {
          receivedQty: { increment: data.qty },
          inStoreQty: { increment: data.qty },
        },
      });

      return { txn, updatedStock };
    });

    res.status(201).json({
      success: true,
      message: 'Stock received successfully',
      transaction: transaction.txn,
      stock: transaction.updatedStock,
    });
  } catch (error) {
    next(error);
  }
};

export const getGALocations = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const sites = await prisma.site.findMany({
      where: { status: 'Active' },
      select: { gaName: true }
    });
    const uniqueGAs = Array.from(new Set(sites.map(s => s.gaName).filter(Boolean)));
    const gaLocations = uniqueGAs.map(name => ({
      id: name,
      name: name,
      label: name
    }));
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.status(200).json({ success: true, gaLocations });
  } catch (error) {
    next(error);
  }
};

export const getCities = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const sites = await prisma.site.findMany({
      where: { status: 'Active' },
      select: { location: true, gaName: true }
    });
    const seen = new Set();
    const cities: any[] = [];
    sites.forEach(s => {
      if (!s.location) return;
      const key = `${s.gaName || ''}_${s.location}`;
      if (!seen.has(key)) {
        seen.add(key);
        cities.push({
          id: s.location,
          name: s.location,
          label: s.location,
          gaId: s.gaName || 'all'
        });
      }
    });
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.status(200).json({ success: true, cities });
  } catch (error) {
    next(error);
  }
};

export const getAreas = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const sites = await prisma.site.findMany({
      where: { status: 'Active' },
      select: { chargeArea: true, location: true, gaName: true }
    });
    const seen = new Set();
    const areas: any[] = [];
    sites.forEach(s => {
      if (!s.chargeArea) return;
      const key = `${s.gaName || ''}_${s.location || ''}_${s.chargeArea}`;
      if (!seen.has(key)) {
        seen.add(key);
        areas.push({
          id: s.chargeArea,
          name: s.chargeArea,
          label: s.chargeArea,
          cityId: s.location || 'all',
          gaId: s.gaName || 'all'
        });
      }
    });
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.status(200).json({ success: true, areas });
  } catch (error) {
    next(error);
  }
};

/* Default stock categories — always returned so the accordion is never empty.
   Additional categories appear automatically once stock items are received. */
const DEFAULT_STOCK_CATEGORIES = [
  'FIM Material',
  'GI Fitting — ½ inch',
  'GI Fitting — ¾ inch',
  'GI Fitting — 1 inch',
  'MDPE Fittings',
  'MLC Fittings',
];

export const getStockCategories = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // Pull all distinct category values already in use from InventoryItem rows
    const rows = await prisma.inventoryItem.findMany({
      distinct: ['category'],
      select: { category: true },
      where: { category: { not: '' } },
      orderBy: { category: 'asc' },
    }).catch(() => [] as { category: string }[]);

    const dbCategories = rows.map(r => r.category).filter(Boolean);

    // Merge defaults with DB-derived categories (deduplicated, sorted)
    const merged = Array.from(new Set([...DEFAULT_STOCK_CATEGORIES, ...dbCategories])).sort();

    const categories = merged.map((name, i) => ({ id: i + 1, name }));

    res.status(200).json({ success: true, categories });
  } catch (error) {
    next(error);
  }
};


export const updateSite = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const schema = z.object({
    name:        z.string().min(1).optional(),
    location:    z.string().optional(),
    gaName:      z.string().optional(),
    chargeArea:  z.string().optional(),
    zone:        z.string().optional(),
    district:    z.string().optional(),
    status:      z.enum(['Active', 'Inactive']).optional(),
    targetConns: z.number().int().nonnegative().optional(),
  });

  try {
    const id = req.params.id as string;
    const data = schema.parse(req.body);

    const site = await prisma.site.findUnique({ where: { id } });
    if (!site) {
      return res.status(404).json({ success: false, error: 'Site not found' });
    }

    // If name is being changed, check uniqueness
    if (data.name && data.name !== site.name) {
      const existing = await prisma.site.findUnique({ where: { name: data.name } });
      if (existing) {
        return res.status(400).json({ success: false, error: 'A site with this name already exists' });
      }
    }

    const updated = await prisma.site.update({ where: { id }, data });

    res.status(200).json({ success: true, site: updated });
  } catch (error) {
    next(error);
  }
};

/* ─── Safe Deletion Helpers & Endpoints ─── */

async function checkSiteIsSafeToDelete(siteId: string, tx: any) {
  const pngCount = await tx.pNGConnection.count({ where: { siteId } });
  if (pngCount > 0) throw new Error(`Site has ${pngCount} active PNG Connections`);

  const invTxnCount = await tx.inventoryTransaction.count({ where: { siteId } });
  if (invTxnCount > 0) throw new Error(`Site has ${invTxnCount} Inventory Transactions`);

  const consumptionCount = await tx.consumptionLog.count({ where: { siteId } });
  if (consumptionCount > 0) throw new Error(`Site has ${consumptionCount} Consumption Logs`);

  const peCount = await tx.pELaying.count({ where: { siteId } });
  if (peCount > 0) throw new Error(`Site has ${peCount} PE Laying records`);

  const icCount = await tx.iCWork.count({ where: { siteId } });
  if (icCount > 0) throw new Error(`Site has ${icCount} I&C records`);

  const meterCount = await tx.meterRegister.count({ where: { siteId } });
  if (meterCount > 0) throw new Error(`Site has ${meterCount} Registered Meters`);
}

// Delete a single Site (area-level)
export const deleteSite = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const siteId = req.params.id as string;

    await prisma.$transaction(async (tx: any) => {
      await checkSiteIsSafeToDelete(siteId, tx);
      await tx.siteStock.deleteMany({ where: { siteId } });
      await tx.siteUser.deleteMany({ where: { siteId } });
      await tx.site.delete({ where: { id: siteId } });
    });

    res.status(200).json({ success: true, message: 'Area deleted safely' });
  } catch (error: any) {
    res.status(409).json({ success: false, error: error.message });
  }
};

// Delete City (all Areas within a GA + City)
export const deleteCity = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const gaName = req.params.gaName as string;
    const location = req.params.location as string;

    await prisma.$transaction(async (tx: any) => {
      const sites = await tx.site.findMany({ where: { gaName, location } });
      if (sites.length === 0) throw new Error('No sites found for this City');

      for (const site of sites) {
        await checkSiteIsSafeToDelete(site.id, tx);
        await tx.siteStock.deleteMany({ where: { siteId: site.id } });
        await tx.siteUser.deleteMany({ where: { siteId: site.id } });
        await tx.site.delete({ where: { id: site.id } });
      }
    });

    res.status(200).json({ success: true, message: 'City and its areas deleted safely' });
  } catch (error: any) {
    res.status(409).json({ success: false, error: error.message });
  }
};

// Delete GA Location (all Cities & Areas within a GA)
export const deleteGALocation = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const gaName = req.params.gaName as string;

    await prisma.$transaction(async (tx: any) => {
      const sites = await tx.site.findMany({ where: { gaName } });
      if (sites.length === 0) throw new Error('No sites found for this GA Location');

      for (const site of sites) {
        await checkSiteIsSafeToDelete(site.id, tx);
        await tx.siteStock.deleteMany({ where: { siteId: site.id } });
        await tx.siteUser.deleteMany({ where: { siteId: site.id } });
        await tx.site.delete({ where: { id: site.id } });
      }
    });

    res.status(200).json({ success: true, message: 'GA Location deleted safely' });
  } catch (error: any) {
    res.status(409).json({ success: false, error: error.message });
  }
};

/* ─────────────────────────────────────────────────────────────────────────
   COLUMN CONFIG  — Site-wide shared column visibility and custom columns.
   Replaces per-browser localStorage ('gppms_custom_columns_house' etc.).
   All users viewing the same site see the same column configuration.

   Structure stored in Site.columnConfig (Json):
   {
     "house": { "customCols": [{key, label}, ...], "hiddenCols": ["key1", ...] },
     "pelaying": { "customCols": [...], "hiddenCols": [...] }
   }
───────────────────────────────────────────────────────────────────────── */
export const getColumnConfig = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const idStr = id as string;
    const table = (req.query.table as string) || 'house';

    const site = await prisma.site.findUnique({
      where: { id: idStr },
      select: { columnConfig: true },
    });

    if (!site) {
      return res.status(404).json({ success: false, error: 'Site not found' });
    }

    const config = (site.columnConfig as Record<string, any>) || {};
    const tableConfig = config[table] || { customCols: [], hiddenCols: [] };

    res.json({ success: true, data: tableConfig });
  } catch (error) {
    next(error);
  }
};

export const updateColumnConfig = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const idStr = id as string;
    const schema = z.object({
      table:      z.string().min(1),
      customCols: z.array(z.object({ key: z.string(), label: z.string() })),
      hiddenCols: z.array(z.string()),
    });

    const { table, customCols, hiddenCols } = schema.parse(req.body);

    // Fetch existing config and merge — so changes to 'house' don't wipe 'pelaying' config
    const site = await prisma.site.findUnique({
      where: { id: idStr },
      select: { columnConfig: true },
    });

    if (!site) {
      return res.status(404).json({ success: false, error: 'Site not found' });
    }

    const existing = (site.columnConfig as Record<string, any>) || {};
    const merged = { ...existing, [table]: { customCols, hiddenCols } };

    await prisma.site.update({
      where: { id: idStr },
      data: { columnConfig: merged },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

