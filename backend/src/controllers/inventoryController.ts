import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import { z } from 'zod';
import prisma from '../config/db';

/* ───────────────────────────────────────────────────────────
   Daily Consumption Log — auto-deducts from site stock
─────────────────────────────────────────────────────────── */

export const getConsumptionLogs = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const siteId = req.params.siteId as string;
    const { from, to, page = '1', limit = '50' } = req.query;

    const where: any = {};
    if (siteId && siteId !== 'all') {
      where.siteId = siteId;
    }
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(String(from));
      if (to) where.date.lte = new Date(String(to));
    }

    const pageNum = parseInt(String(page), 10);
    const limitNum = parseInt(String(limit), 10);
    const skip = (pageNum - 1) * limitNum;

    const [logs, total] = await Promise.all([
      prisma.consumptionLog.findMany({
        where,
        include: { user: { select: { id: true, name: true } } },
        orderBy: { date: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.consumptionLog.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      logs,
    });
  } catch (error) {
    next(error);
  }
};

const quantitiesSchema = z.record(z.string().uuid(), z.number().nonnegative());

export const submitConsumptionLog = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const schema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    locationDesc: z.string().min(1),
    workerName: z.string().min(1),
    quantities: quantitiesSchema, // { [materialId]: qty }
  });

  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const siteId = req.params.siteId as string;
    const data = schema.parse(req.body);

    if (Object.keys(data.quantities).length === 0) {
      return res.status(400).json({ success: false, error: 'At least one material quantity is required' });
    }

    // Use a transaction to create the log AND deduct from site_stock atomically
    const result = await prisma.$transaction(async (tx) => {
      const log = await tx.consumptionLog.create({
        data: {
          siteId,
          userId: req.user!.id,
          date: new Date(data.date),
          locationDesc: data.locationDesc,
          workerName: data.workerName,
          quantities: data.quantities,
        },
      });

      // Auto-deduct from site_stock and log each as an ISSUE transaction
      for (const [materialId, qty] of Object.entries(data.quantities)) {
        if (qty <= 0) continue;

        const stock = await tx.siteStock.findUnique({
          where: { siteId_materialId: { siteId, materialId } },
        });

        if (!stock) continue; // skip unknown materials

        // Deduct from issuedQty (and reflect on inStoreQty)
        await tx.siteStock.update({
          where: { siteId_materialId: { siteId, materialId } },
          data: {
            issuedQty: stock.issuedQty.toNumber() + qty,
            inStoreQty: Math.max(0, stock.inStoreQty.toNumber() - qty),
          },
        });

        await tx.inventoryTransaction.create({
          data: {
            siteId,
            materialId,
            transactionType: 'ISSUE',
            qty,
            date: new Date(data.date),
            loggedByUserId: req.user!.id,
          },
        });
      }

      return log;
    });

    res.status(201).json({ success: true, log: result });
  } catch (error) {
    next(error);
  }
};

/* ───────────────────────────────────────────────────────────
   PE Return Log — auto-increases site stock
─────────────────────────────────────────────────────────── */

export const getPEReturns = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const siteId = req.params.siteId as string;
    const where: any = {};
    if (siteId && siteId !== 'all') {
      where.siteId = siteId;
    }
    const logs = await prisma.pEReturnLog.findMany({
      where,
      include: { user: { select: { id: true, name: true } } },
      orderBy: { date: 'desc' },
    });
    res.status(200).json({ success: true, logs });
  } catch (error) {
    next(error);
  }
};

export const submitPEReturn = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const schema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    bookRef: z.string().optional(),
    quantities: quantitiesSchema,
  });

  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const siteId = req.params.siteId as string;
    const data = schema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      const log = await tx.pEReturnLog.create({
        data: {
          siteId,
          userId: req.user!.id,
          date: new Date(data.date),
          bookRef: data.bookRef,
          quantities: data.quantities,
        },
      });

      // Auto-increase returnedQty and inStoreQty in site_stock
      for (const [materialId, qty] of Object.entries(data.quantities)) {
        if (qty <= 0) continue;

        const stock = await tx.siteStock.findUnique({
          where: { siteId_materialId: { siteId, materialId } },
        });
        if (!stock) continue;

        await tx.siteStock.update({
          where: { siteId_materialId: { siteId, materialId } },
          data: {
            returnedQty: stock.returnedQty.toNumber() + qty,
            inStoreQty: stock.inStoreQty.toNumber() + qty,
          },
        });

        await tx.inventoryTransaction.create({
          data: {
            siteId,
            materialId,
            transactionType: 'RETURN',
            qty,
            date: new Date(data.date),
            loggedByUserId: req.user!.id,
          },
        });
      }

      return log;
    });

    res.status(201).json({ success: true, log: result });
  } catch (error) {
    next(error);
  }
};

/* ───────────────────────────────────────────────────────────
   GI Return Log — auto-increases site stock
─────────────────────────────────────────────────────────── */

export const getGIReturns = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const siteId = req.params.siteId as string;
    const where: any = {};
    if (siteId && siteId !== 'all') {
      where.siteId = siteId;
    }
    const logs = await prisma.gIReturnLog.findMany({
      where,
      include: { user: { select: { id: true, name: true } } },
      orderBy: { date: 'desc' },
    });
    res.status(200).json({ success: true, logs });
  } catch (error) {
    next(error);
  }
};

export const submitGIReturn = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const schema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    bookRef: z.string().optional(),
    quantities: quantitiesSchema,
  });

  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const siteId = req.params.siteId as string;
    const data = schema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      const log = await tx.gIReturnLog.create({
        data: {
          siteId,
          userId: req.user!.id,
          date: new Date(data.date),
          bookRef: data.bookRef,
          quantities: data.quantities,
        },
      });

      for (const [materialId, qty] of Object.entries(data.quantities)) {
        if (qty <= 0) continue;

        const stock = await tx.siteStock.findUnique({
          where: { siteId_materialId: { siteId, materialId } },
        });
        if (!stock) continue;

        await tx.siteStock.update({
          where: { siteId_materialId: { siteId, materialId } },
          data: {
            returnedQty: stock.returnedQty.toNumber() + qty,
            inStoreQty: stock.inStoreQty.toNumber() + qty,
          },
        });

        await tx.inventoryTransaction.create({
          data: {
            siteId,
            materialId,
            transactionType: 'RETURN',
            qty,
            date: new Date(data.date),
            loggedByUserId: req.user!.id,
          },
        });
      }

      return log;
    });

    res.status(201).json({ success: true, log: result });
  } catch (error) {
    next(error);
  }
};

/* ───────────────────────────────────────────────────────────
   Tool Returns
─────────────────────────────────────────────────────────── */

export const getToolReturns = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const siteId = req.params.siteId as string;
    const where: any = {};
    if (siteId && siteId !== 'all') {
      where.siteId = siteId;
    }
    const returns = await prisma.toolReturn.findMany({
      where,
      orderBy: { date: 'desc' },
    });
    res.status(200).json({ success: true, returns });
  } catch (error) {
    next(error);
  }
};

export const submitToolReturn = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const schema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    dcNo: z.string().optional(),
    contractorName: z.string().min(1),
    quantities: z.record(z.string(), z.number().nonnegative()),
  });

  try {
    const siteId = req.params.siteId as string;
    const data = schema.parse(req.body);

    const record = await prisma.toolReturn.create({
      data: {
        siteId,
        date: new Date(data.date),
        dcNo: data.dcNo,
        contractorName: data.contractorName,
        quantities: data.quantities,
      },
    });

    res.status(201).json({ success: true, record });
  } catch (error) {
    next(error);
  }
};
