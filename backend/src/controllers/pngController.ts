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
    appNo: z.string().nullable().optional(),
    bpNo: z.string().nullable().optional(),
    accountType: z.nativeEnum(AccountType).nullable().optional(),
    customerName: z.string().min(1, "Customer name required"),
    mobile: z.string().min(10, "Mobile must be at least 10 digits"),
    altMobile: z.string().nullable().optional(),
    houseNo: z.string().nullable().optional(),
    address1: z.string().nullable().optional(),
    address2: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    society: z.string().nullable().optional(),
    supervisorId: z.string().uuid().nullable().optional(),
    assignDateAgency: z.string().nullable().optional(),
    assignDateSuper: z.string().nullable().optional(),
    bpCreationDate: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    plumbingDate: z.string().nullable().optional(),
    gcLength: z.number().nonnegative().nullable().optional(),
    giPipeMtr: z.number().nonnegative().nullable().optional(),
    tfCount: z.number().int().nonnegative().nullable().optional(),
    ivCount: z.number().int().nonnegative().nullable().optional(),
  });

  try {
    const siteId = req.params.siteId as string;
    const data = schema.parse(req.body);

    const appNo = (data.appNo && data.appNo.trim())
      ? data.appNo.trim()
      : `APP-GEN-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    const existing = await prisma.pNGConnection.findUnique({ where: { appNo } });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Application number already exists' });
    }

    const connection = await prisma.pNGConnection.create({
      data: {
        siteId,
        appNo,
        bpNo: data.bpNo || null,
        accountType: data.accountType || AccountType.DOMESTIC,
        customerName: data.customerName,
        mobile: data.mobile,
        altMobile: data.altMobile || null,
        houseNo: data.houseNo || "",
        address1: data.address1 || "",
        address2: data.address2 || null,
        city: data.city || "",
        society: data.society || null,
        supervisorId: data.supervisorId || null,
        status: data.status || 'Pending',
        assignDateAgency: data.assignDateAgency ? new Date(data.assignDateAgency) : null,
        assignDateSuper: data.assignDateSuper ? new Date(data.assignDateSuper) : null,
        bpCreationDate: data.bpCreationDate ? new Date(data.bpCreationDate) : null,
        plumbingDate: data.plumbingDate ? new Date(data.plumbingDate) : null,
        gcLength: data.gcLength ?? null,
        giPipeMtr: data.giPipeMtr ?? null,
        tfCount: data.tfCount ?? 0,
        ivCount: data.ivCount ?? 0,
      },
    });

    res.status(201).json({ success: true, connection });
  } catch (error) {
    next(error);
  }
};

export const updatePNGConnection = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const schema = z.object({
    status: z.string().nullable().optional(),
    bpNo: z.string().nullable().optional(),
    plumbingDate: z.string().nullable().optional(),
    gcLength: z.number().nonnegative().nullable().optional(),
    giPipeMtr: z.number().nonnegative().nullable().optional(),
    tfCount: z.number().int().nonnegative().nullable().optional(),
    ivCount: z.number().int().nonnegative().nullable().optional(),
    supervisorId: z.string().uuid().nullable().optional(),
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
        status: data.status || undefined,
        bpNo: data.bpNo !== undefined ? data.bpNo : undefined,
        plumbingDate: data.plumbingDate ? new Date(data.plumbingDate) : (data.plumbingDate === null ? null : undefined),
        gcLength: data.gcLength !== undefined ? data.gcLength : undefined,
        giPipeMtr: data.giPipeMtr !== undefined ? data.giPipeMtr : undefined,
        tfCount: data.tfCount !== undefined ? data.tfCount : undefined,
        ivCount: data.ivCount !== undefined ? data.ivCount : undefined,
        supervisorId: data.supervisorId !== undefined ? data.supervisorId : undefined,
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
