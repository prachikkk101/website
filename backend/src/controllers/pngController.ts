import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import { z } from 'zod';
import prisma from '../config/db';
import { AccountType } from '@prisma/client';

/* ───────────────────────────────────────────────────────────
   PNG Connections
─────────────────────────────────────────────────────────── */

export const getPNGConnections = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const siteId = req.params.siteId as string;
    const { accountType, area, bpNo, houseNo, status, page = '1', limit = '50' } = req.query;

    const where: any = { siteId };
    if (accountType) where.accountType = accountType as AccountType;
    if (bpNo) where.bpNo = { contains: String(bpNo), mode: 'insensitive' };
    if (houseNo) where.houseNo = { contains: String(houseNo), mode: 'insensitive' };
    if (area) where.society = { contains: String(area), mode: 'insensitive' };
    if (status) where.status = String(status);

    const pageNum = parseInt(String(page), 10);
    const limitNum = parseInt(String(limit), 10);
    const skip = (pageNum - 1) * limitNum;

    const [connections, total] = await Promise.all([
      prisma.pNGConnection.findMany({
        where,
        include: {
          supervisor: { select: { id: true, name: true } },
          meterInstallation: true,
        },
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.pNGConnection.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      connections,
    });
  } catch (error) {
    next(error);
  }
};

export const createPNGConnection = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const schema = z.object({
    appNo: z.string().min(1),
    bpNo: z.string().optional(),
    accountType: z.nativeEnum(AccountType).default(AccountType.DOMESTIC),
    customerName: z.string().min(1),
    mobile: z.string().min(10),
    altMobile: z.string().optional(),
    houseNo: z.string().min(1),
    address1: z.string().min(1),
    address2: z.string().optional(),
    city: z.string().min(1),
    society: z.string().optional(),
    supervisorId: z.string().uuid().optional(),
    assignDateAgency: z.string().optional(),
    assignDateSuper: z.string().optional(),
    bpCreationDate: z.string().optional(),
    status: z.string().default('Pending'),
    plumbingDate: z.string().optional(),
    gcLength: z.number().nonnegative().optional(),
    giPipeMtr: z.number().nonnegative().optional(),
    tfCount: z.number().int().nonnegative().optional(),
    ivCount: z.number().int().nonnegative().optional(),
  });

  try {
    const siteId = req.params.siteId as string;
    const data = schema.parse(req.body);

    const existing = await prisma.pNGConnection.findUnique({ where: { appNo: data.appNo } });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Application number already exists' });
    }

    const connection = await prisma.pNGConnection.create({
      data: {
        siteId,
        ...data,
        assignDateAgency: data.assignDateAgency ? new Date(data.assignDateAgency) : null,
        assignDateSuper: data.assignDateSuper ? new Date(data.assignDateSuper) : null,
        bpCreationDate: data.bpCreationDate ? new Date(data.bpCreationDate) : null,
        plumbingDate: data.plumbingDate ? new Date(data.plumbingDate) : null,
      },
    });

    res.status(201).json({ success: true, connection });
  } catch (error) {
    next(error);
  }
};

export const updatePNGConnection = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const schema = z.object({
    status: z.string().optional(),
    bpNo: z.string().optional(),
    plumbingDate: z.string().optional(),
    gcLength: z.number().nonnegative().optional(),
    giPipeMtr: z.number().nonnegative().optional(),
    tfCount: z.number().int().nonnegative().optional(),
    ivCount: z.number().int().nonnegative().optional(),
    supervisorId: z.string().uuid().optional(),
  });

  try {
    const connectionId = req.params.connectionId as string;
    const data = schema.parse(req.body);

    const existing = await prisma.pNGConnection.findUnique({ where: { id: connectionId } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Connection not found' });
    }

    const updated = await prisma.pNGConnection.update({
      where: { id: connectionId },
      data: {
        ...data,
        plumbingDate: data.plumbingDate ? new Date(data.plumbingDate) : undefined,
        updatedAt: new Date(),
      },
    });

    res.status(200).json({ success: true, connection: updated });
  } catch (error) {
    next(error);
  }
};

/* ───────────────────────────────────────────────────────────
   Meter Installation
─────────────────────────────────────────────────────────── */

export const submitMeterInstallation = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const schema = z.object({
    meterMake: z.string().min(1),
    serialNo: z.string().min(1),
    meterReading: z.number().nonnegative(),
    lhsRhs: z.enum(['LHS', 'RHS']),
    installationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    meterPhotoUrl: z.string().url().optional(),
  });

  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const connectionId = req.params.connectionId as string;
    const data = schema.parse(req.body);

    // Verify connection exists
    const connection = await prisma.pNGConnection.findUnique({ where: { id: connectionId } });
    if (!connection) {
      return res.status(404).json({ success: false, error: 'PNG Connection not found' });
    }

    // Enforce duplicate serial number prevention at DB level (will throw on unique constraint)
    const existingSerial = await prisma.meterInstallation.findUnique({ where: { serialNo: data.serialNo } });
    if (existingSerial) {
      return res.status(400).json({
        success: false,
        error: `Meter serial number "${data.serialNo}" is already registered to another connection`,
      });
    }

    const meter = await prisma.meterInstallation.upsert({
      where: { pngConnectionId: connectionId },
      update: {
        ...data,
        installationDate: new Date(data.installationDate),
        installedByUserId: req.user.id,
        updatedAt: new Date(),
      },
      create: {
        pngConnectionId: connectionId,
        siteId: connection.siteId,
        installedByUserId: req.user.id,
        ...data,
        installationDate: new Date(data.installationDate),
      },
    });

    // Also update connection status to indicate meter installed
    await prisma.pNGConnection.update({
      where: { id: connectionId },
      data: { status: 'Meter Installed', updatedAt: new Date() },
    });

    try {
      await prisma.meterRegister.update({
        where: { serialNo: data.serialNo },
        data: { status: 'Installed', pngConnectionId: connectionId, updatedAt: new Date() },
      });
    } catch (e) {
      // Meter might not be in register, ignore
    }

    res.status(201).json({ success: true, meter });
  } catch (error) {
    next(error);
  }
};
