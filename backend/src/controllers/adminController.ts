import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import { z } from 'zod';
import * as bcrypt from 'bcryptjs';
import prisma from '../config/db';
import { Role, Prisma } from '@prisma/client';

/* ─── Aggregate Admin Dashboard ─────────────────────────── */

export const getAdminDashboard = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const sites = await prisma.site.findMany({
      include: { _count: { select: { connections: true } } },
    });

    const dashboardData = await Promise.all(
      sites.map(async (site) => {
        const totalConns = site._count.connections;
        const doneConns = await prisma.pNGConnection.count({ where: { siteId: site.id, status: 'Done' } });
        const metersInstalled = await prisma.meterInstallation.count({ where: { siteId: site.id } });
        const rfcConns = await prisma.pNGConnection.count({ where: { siteId: site.id, status: 'RFC' } });
        const lmcDone = await prisma.lMCWork.count({
          where: { siteId: site.id, remarks: { equals: 'DONE', mode: 'insensitive' } },
        });
        const icDone = await prisma.iCWork.count({ where: { siteId: site.id, status: 'Done' } });

        // Low-stock alert check — use same percentage thresholds as Inventory Stock Statement:
        // Critical: inStore < 20% of received; Low: inStore < 50% of received.
        // Only flag items where stock has actually been received (received > 0).
        // NOTE: We no longer use requiredQty because that field was seeded with dummy data
        // and is never set by the real UI, causing phantom low-stock banners.
        const allStock = await prisma.siteStock.findMany({
          where: { siteId: site.id },
          include: { material: { select: { name: true, unit: true } } },
        });
        const lowStockItems = allStock.filter(s => {
          const received = s.receivedQty.toNumber();
          const inStore  = s.inStoreQty.toNumber();
          if (received === 0) return false; // never received — no data yet, not low stock
          const pct = (inStore / received) * 100;
          return pct < 50; // Low (<50%) or Critical (<20%)
        });

        return {
          siteId: site.id,
          siteName: site.name,
          status: site.status,
          targetConns: site.targetConns,
          totalConns,
          doneConns,
          rfcConns,
          metersInstalled,
          lmcDone,
          icDone,
          completionPct: site.targetConns > 0 ? Math.round((doneConns / site.targetConns) * 100) : 0,
          lowStockAlerts: lowStockItems.map(s => {
            const received = s.receivedQty.toNumber();
            const inStore  = s.inStoreQty.toNumber();
            const pct = received > 0 ? Math.round((inStore / received) * 100) : 0;
            return {
              material: s.material.name,
              unit: s.material.unit,
              inStore,
              received,
              pct,
              severity: pct < 20 ? 'Critical' : 'Low',
            };
          }),
        };
      })
    );

    // Overall platform aggregates
    const totalApplications = await prisma.pNGConnection.count();
    const totalMeters = await prisma.meterInstallation.count();
    const totalPELaying = await prisma.pELaying.aggregate({
      _sum: { d32oc: true, d32b: true, d63oc: true, d63b: true, d63hdd: true, d90tot: true, d125tot: true },
    });

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.status(200).json({
      success: true,
      sites: dashboardData,
      totals: {
        totalApplications,
        totalMeters,
        peLaying: totalPELaying._sum,
      },
    });
  } catch (error) {
    next(error);
  }
};

/* ─── User Management (Admin only) ─────────────────────── */

export const getUsers = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        assignedSites: {
          include: {
            site: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({ success: true, users });
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const schema = z.object({
    email: z.string().email(),
    name: z.string().min(1),
    password: z.string().min(6),
    role: z.nativeEnum(Role).default(Role.WORKER),
  });

  try {
    const data = schema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Email already registered' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash,
        role: data.role,
        emailVerified: true, // Admin-created users are pre-verified
      },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });

    res.status(201).json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const schema = z.object({
    name: z.string().optional(),
    role: z.nativeEnum(Role).optional(),
    password: z.string().min(6).optional(),
  });

  try {
    const userId = req.params.userId as string;
    const data = schema.parse(req.body);

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.password) {
      const salt = await bcrypt.genSalt(10);
      updateData.passwordHash = await bcrypt.hash(data.password, salt);
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, email: true, name: true, role: true, updatedAt: true },
    });

    res.status(200).json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

/* ─── Admin Whitelist Management ────────────────────────── */

export const getWhitelist = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const whitelist = await prisma.adminWhitelist.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json({ success: true, whitelist });
  } catch (error) {
    next(error);
  }
};

export const addToWhitelist = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const schema = z.object({ email: z.string().email() });

  try {
    const { email } = schema.parse(req.body);

    const existing = await prisma.adminWhitelist.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Email already in whitelist' });
    }

    const entry = await prisma.adminWhitelist.create({ data: { email } });

    // If the user already exists, upgrade their role to ADMIN
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      await prisma.user.update({
        where: { email },
        data: { role: Role.ADMIN },
      });
    }

    res.status(201).json({ success: true, entry, message: 'Email whitelisted. Existing user (if any) upgraded to Admin.' });
  } catch (error) {
    next(error);
  }
};

export const removeFromWhitelist = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid whitelist entry ID' });
    }
    const existing = await prisma.adminWhitelist.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Whitelist entry not found' });
    }
    await prisma.adminWhitelist.delete({ where: { id } });
    res.status(200).json({ success: true, message: 'Email removed from whitelist' });
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.userId as string;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Delete all records that reference this user (FK constraints without onDelete: Cascade).
    // SiteUser and Attendance[userId] already have onDelete: Cascade on the schema,
    // but we still clean up the others explicitly to avoid constraint violations.
    await prisma.$transaction(async (tx: any) => {
      // Nullify AuditLog (nullable userId — Prisma handles SetNull when nullable and
      // we set it explicitly here to be safe across DB providers)
      await tx.auditLog.updateMany({ where: { userId }, data: { userId: null } });
      // Delete stock-related logs
      await tx.consumptionLog.deleteMany({ where: { userId } });
      await tx.pEReturnLog.deleteMany({ where: { userId } });
      await tx.gIReturnLog.deleteMany({ where: { userId } });
      await tx.inventoryTransaction.deleteMany({ where: { loggedByUserId: userId } });
      // Delete attendance records either attended by OR marked by this user
      await tx.attendance.deleteMany({ where: { OR: [{ userId }, { markedByUserId: userId }] } });
      // SiteUser has onDelete: Cascade but explicit delete ensures the user row can be removed
      await tx.siteUser.deleteMany({ where: { userId } });
      // Finally delete the user itself
      await tx.user.delete({ where: { id: userId } });
    });

    res.status(200).json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    // Surface FK constraint errors with a helpful message
    const prismaError = error as Prisma.PrismaClientKnownRequestError;
    if (prismaError.code === 'P2003') {
      return (res as Response).status(409).json({
        success: false,
        error: 'Cannot delete user — they have associated records. Please contact your admin to remove their data entries first.',
      });
    }
    next(error);
  }
};

export const removeSiteAssignment = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.userId as string;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    await prisma.siteUser.deleteMany({ where: { userId } });
    res.status(200).json({ success: true, message: 'Site assignment(s) removed' });
  } catch (error) {
    next(error);
  }
};

// Remove a SINGLE specific site assignment (not all sites) for a user
export const removeSingleSiteAssignment = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { userId, siteId } = req.params as { userId: string; siteId: string };
    const result = await prisma.siteUser.deleteMany({ where: { userId, siteId } });
    if (result.count === 0) {
      return res.status(404).json({ success: false, error: 'Assignment not found' });
    }
    res.status(200).json({ success: true, message: 'Site removed from user' });
  } catch (error) {
    next(error);
  }
};
