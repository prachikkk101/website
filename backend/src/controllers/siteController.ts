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

    // Automatically instantiate site_stock for all materials
    const materials = await prisma.materialItem.findMany();
    for (const mat of materials) {
      await prisma.siteStock.create({
        data: {
          siteId: site.id,
          materialId: mat.id,
          openingQty: 0,
          receivedQty: 0,
          issuedQty: 0,
          returnedQty: 0,
          onSiteQty: 0,
          inStoreQty: 0,
          requiredQty: 0,
        },
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

      // 2. Update Received and Store quantities in site_stock
      const stock = await tx.siteStock.findUnique({
        where: { siteId_materialId: { siteId, materialId: data.materialId } },
      });

      if (!stock) {
        throw new Error('Stock entry not initialized for this material on the site');
      }

      const updatedStock = await tx.siteStock.update({
        where: { siteId_materialId: { siteId, materialId: data.materialId } },
        data: {
          receivedQty: stock.receivedQty.toNumber() + data.qty,
          inStoreQty: stock.inStoreQty.toNumber() + data.qty,
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

export const deleteSite = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const site = await prisma.site.findUnique({ where: { id } });
    if (!site) {
      return res.status(404).json({ success: false, error: 'Site not found' });
    }

    // Cascade-delete all child records in FK-safe order
    // 1. MeterInstallation (references PNGConnection)
    await prisma.meterInstallation.deleteMany({ where: { siteId: id } });

    // 2. MeterRegister (references Site and optionally PNGConnection)
    await prisma.meterRegister.deleteMany({ where: { siteId: id } });

    // 3. Attendance
    await prisma.attendance.deleteMany({ where: { siteId: id } });

    // 4. ICWork & LMCWork
    await prisma.iCWork.deleteMany({ where: { siteId: id } });
    await prisma.lMCWork.deleteMany({ where: { siteId: id } });

    // 5. PELaying
    await prisma.pELaying.deleteMany({ where: { siteId: id } });

    // 6. ToolReturn
    await prisma.toolReturn.deleteMany({ where: { siteId: id } });

    // 7. ConsumptionLog, PEReturnLog, GIReturnLog
    await prisma.consumptionLog.deleteMany({ where: { siteId: id } });
    await prisma.pEReturnLog.deleteMany({ where: { siteId: id } });
    await prisma.gIReturnLog.deleteMany({ where: { siteId: id } });

    // 8. InventoryTransaction
    await prisma.inventoryTransaction.deleteMany({ where: { siteId: id } });

    // 9. InventoryItem
    await prisma.inventoryItem.deleteMany({ where: { siteId: id } });

    // 10. SiteStock
    await prisma.siteStock.deleteMany({ where: { siteId: id } });

    // 11. PNGConnection (now safe — MeterInstallation & MeterRegister removed)
    await prisma.pNGConnection.deleteMany({ where: { siteId: id } });

    // 12. SiteUser
    await prisma.siteUser.deleteMany({ where: { siteId: id } });

    // 13. Finally delete the Site itself
    await prisma.site.delete({ where: { id } });

    res.status(200).json({ success: true, message: `Site "${site.name}" and all associated records deleted.` });
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
    const { id } = req.params;
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
