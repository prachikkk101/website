import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { checkSiteAccess } from '../middlewares/checkSiteAccess';
import prisma from '../config/db';
import { AuthenticatedRequest } from '../middlewares/auth';
import { Response, NextFunction } from 'express';

const router = Router({ mergeParams: true }); // inherits :siteId from parent

/* ── GET /api/sites/:siteId/inventory/history?date=YYYY-MM-DD
   Returns stock snapshot for a site as of a given date.
   Currently returns current InventoryItem state (best-effort).
   When a StockTransaction log table is added, this endpoint
   can reconstruct true historical state from cumulative totals.
─────────────────────────────────────────────────────────── */
router.get(
  '/history',
  authenticate,
  checkSiteAccess,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const siteId = req.params.siteId as string;
      const dateStr = (req.query.date as string) || new Date().toISOString().split('T')[0];

      // Return current inventory state (with dateQueried for reference)
      const items = await prisma.inventoryItem.findMany({
        where: { siteId },
        orderBy: { material: 'asc' },
      });

      res.json({
        success: true,
        dateQueried: dateStr,
        siteId,
        items,
        note: 'Snapshot reflects current state. True date-accurate history will be available once transaction logging is enabled.',
      });
    } catch (err) {
      next(err);
    }
  }
);

/* ── GET /api/sites/:siteId/inventory
   Returns all InventoryItems for a site, ordered alphabetically by material.
─────────────────────────────────────────────────────────── */
router.get(
  '/',
  authenticate,
  checkSiteAccess,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const siteId = req.params.siteId as string;
      const items = await prisma.inventoryItem.findMany({
        where: { siteId },
        orderBy: { material: 'asc' },
      });
      res.json({ success: true, items });
    } catch (err) {
      next(err);
    }
  }
);


/* ── POST /api/sites/:siteId/inventory/receive
   Upserts one or more items. If the material already exists for this site,
   increments received and inStore. Otherwise creates a new row.
   Body: { items: [{ material, qty, unit, category }], challanNo?, date? }
─────────────────────────────────────────────────────────── */
router.post(
  '/receive',
  authenticate,
  checkSiteAccess,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const siteId = req.params.siteId as string;
      const { items } = req.body as {
        items: { material: string; qty: number; unit?: string; category?: string }[];
      };

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, error: 'items array is required' });
      }

      const results = [];
      for (const item of items) {
        const material = String(item.material);
        const qty      = Number(item.qty);
        const unit     = String(item.unit     ?? 'pcs');
        const category = String(item.category ?? '');
        if (!material || qty <= 0) continue;

        const upserted = await prisma.inventoryItem.upsert({
          where: { siteId_material: { siteId, material } },
          update: {
            received: { increment: qty },
            inStore:  { increment: qty },
            updatedAt: new Date(),
          },
          create: {
            siteId,
            material,
            unit,
            category,
            received: qty,
            inStore: qty,
            issued: 0,
            returned: 0,
          },
        });
        results.push(upserted);
      }

      res.status(201).json({ success: true, items: results });
    } catch (err) {
      next(err);
    }
  }
);

/* ── POST /api/sites/:siteId/inventory/return
   Increments returned; recalculates inStore = received - issued - returned.
   Body: { items: [{ material, qty }] }
─────────────────────────────────────────────────────────── */
router.post(
  '/return',
  authenticate,
  checkSiteAccess,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const siteId = req.params.siteId as string;
      const { items } = req.body as { items: { material: string; qty: number }[] };

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, error: 'items array is required' });
      }

      const results = [];
      for (const item of items) {
        const material = String(item.material);
        const qty      = Number(item.qty);
        if (!material || qty <= 0) continue;

        const existing = await prisma.inventoryItem.findUnique({
          where: { siteId_material: { siteId, material } },
        });
        if (!existing) continue;

        const newReturned  = existing.returned + qty;
        const newAvailable = Math.max(0, existing.received - existing.issued - newReturned);

        const updated = await prisma.inventoryItem.update({
          where: { siteId_material: { siteId, material } },
          data: {
            returned:  newReturned,
            inStore:   newAvailable,
            updatedAt: new Date(),
          },
        });
        results.push(updated);
      }

      res.json({ success: true, items: results });
    } catch (err) {
      next(err);
    }
  }
);

/* ── PUT /api/sites/:siteId/inventory/:material
   Full update of a single item's numeric fields.
   Body: { issued?, returned?, inStore?, received? }
─────────────────────────────────────────────────────────── */
router.put(
  '/:material',
  authenticate,
  checkSiteAccess,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const siteId   = req.params.siteId   as string;
      const material = req.params.material as string;
      const { issued, returned, inStore, received } = req.body as {
        issued?: number; returned?: number; inStore?: number; received?: number;
      };

      const existing = await prisma.inventoryItem.findUnique({
        where: { siteId_material: { siteId, material } },
      });
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Item not found' });
      }

      const updated = await prisma.inventoryItem.update({
        where: { siteId_material: { siteId, material } },
        data: {
          ...(issued    !== undefined && { issued }),
          ...(returned  !== undefined && { returned }),
          ...(inStore   !== undefined && { inStore }),
          ...(received  !== undefined && { received }),
          updatedAt: new Date(),
        },
      });

      res.json({ success: true, item: updated });
    } catch (err) {
      next(err);
    }
  }
);

/* ── DELETE /api/sites/:siteId/inventory/:material
   Permanently removes a stock item for this site.
─────────────────────────────────────────────────────────── */
router.delete(
  '/:material',
  authenticate,
  checkSiteAccess,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const siteId   = req.params.siteId   as string;
      const material = req.params.material as string;
      await prisma.inventoryItem.deleteMany({ where: { siteId, material } });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
