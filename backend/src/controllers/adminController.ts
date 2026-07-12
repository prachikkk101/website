import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import { z } from 'zod';
import * as bcrypt from 'bcryptjs';
import prisma from '../config/db';
import { Role } from '@prisma/client';

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

        // Low-stock alert check — compare columns in JS since Prisma can't do cross-column WHERE
        const allStock = await prisma.siteStock.findMany({
          where: { siteId: site.id },
          include: { material: { select: { name: true, unit: true } } },
        });
        const lowStockItems = allStock.filter(
          s => s.requiredQty.toNumber() > 0 && s.inStoreQty.toNumber() < s.requiredQty.toNumber()
        );


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
          lowStockAlerts: lowStockItems.map(s => ({
            material: s.material.name,
            unit: s.material.unit,
            inStore: s.inStoreQty,
            required: s.requiredQty,
          })),
        };
      })
    );

    // Overall platform aggregates
    const totalApplications = await prisma.pNGConnection.count();
    const totalMeters = await prisma.meterInstallation.count();
    const totalPELaying = await prisma.pELaying.aggregate({
      _sum: { d32oc: true, d32b: true, d63oc: true, d63b: true, d63hdd: true, d90tot: true, d125tot: true },
    });

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

    // Delete in a transaction: remove related SiteUser rows first (FK constraint),
    // then delete the user record itself.
    await prisma.$transaction(async (tx: any) => {
      await tx.siteUser.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
    });

    res.status(200).json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
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
