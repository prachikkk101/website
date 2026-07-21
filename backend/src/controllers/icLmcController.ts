import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import { z } from 'zod';
import prisma from '../config/db';
import { ICStatus } from '@prisma/client';

/* ─── I&C Work ─────────────────────────────────────────── */

export const getICWork = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const siteId = req.params.siteId as string;
    const { status } = req.query;

    const where: any = {};
    if (siteId && siteId !== 'all') {
      where.siteId = siteId;
    }
    if (status) where.status = status as ICStatus;

    const records = await prisma.iCWork.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const doneCount = records.filter(r => r.status === ICStatus.Done).length;
    const pendingCount = records.filter(r => r.status === ICStatus.Pending).length;

    res.status(200).json({ success: true, records, doneCount, pendingCount });
  } catch (error) {
    next(error);
  }
};

export const createICWork = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const schema = z.object({
    customerName: z.string().min(1),
    address: z.string().min(1),
    icDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    regulatorPoutMbar: z.number().nonnegative(),
    flowRateScmh: z.number().nonnegative(),
    regulatorNo: z.string().optional(),
    meterSerialNo: z.string().optional(),
    status: z.nativeEnum(ICStatus).default(ICStatus.Pending),
  });

  try {
    const siteId = req.params.siteId as string;
    const data = schema.parse(req.body);

    const record = await prisma.iCWork.create({
      data: {
        siteId,
        ...data,
        icDate: data.icDate ? new Date(data.icDate as string) : null,
      },
    });

    res.status(201).json({ success: true, record });
  } catch (error) {
    next(error);
  }
};

export const updateICWork = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const schema = z.object({
    icDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    regulatorPoutMbar: z.number().nonnegative().optional(),
    flowRateScmh: z.number().nonnegative().optional(),
    regulatorNo: z.string().optional(),
    meterSerialNo: z.string().optional(),
    status: z.nativeEnum(ICStatus).optional(),
  });

  try {
    const recordId = req.params.recordId as string;
    const data = schema.parse(req.body);

    const updated = await prisma.iCWork.update({
      where: { id: recordId },
      data: {
        ...data,
        icDate: data.icDate ? new Date(data.icDate) : undefined,
        updatedAt: new Date(),
      },
    });

    res.status(200).json({ success: true, record: updated });
  } catch (error) {
    next(error);
  }
};

/* ─── LMC Work ─────────────────────────────────────────── */

export const getLMCWork = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const siteId = req.params.siteId as string;
    const { appNo, bpNo } = req.query;

    const where: any = {};
    if (siteId && siteId !== 'all') {
      where.siteId = siteId;
    }
    if (appNo) where.appNo = { contains: String(appNo), mode: 'insensitive' };
    if (bpNo) where.bpNo = { contains: String(bpNo), mode: 'insensitive' };

    const records = await prisma.lMCWork.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const doneCount = records.filter(r => r.remarks?.toUpperCase() === 'DONE').length;
    const pendingCount = records.filter(r => r.remarks?.toUpperCase() !== 'DONE').length;

    res.status(200).json({ success: true, records, doneCount, pendingCount });
  } catch (error) {
    next(error);
  }
};

export const createLMCWork = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const schema = z.object({
    appNo: z.string().min(1),
    bpNo: z.string().nullable().optional(),
    customerName: z.string().min(1),
    address: z.string().min(1),
    lmcDate: z.string().nullable().optional(),
    regulatorNo: z.string().nullable().optional(),
    meterSerialNo: z.string().nullable().optional(),
    remarks: z.string().nullable().optional(),
  });

  try {
    const siteId = req.params.siteId as string;
    const data = schema.parse(req.body);

    const existing = await prisma.lMCWork.findUnique({ where: { appNo: data.appNo } });
    if (existing) {
      return res.status(400).json({ success: false, error: 'LMC record for this Application No. already exists' });
    }

    const record = await prisma.lMCWork.create({
      data: {
        siteId,
        appNo: data.appNo,
        bpNo: data.bpNo || null,
        customerName: data.customerName,
        address: data.address,
        lmcDate: data.lmcDate ? new Date(data.lmcDate as string) : null,
        regulatorNo: data.regulatorNo || null,
        meterSerialNo: data.meterSerialNo || null,
        remarks: data.remarks || null,
      },
    });

    res.status(201).json({ success: true, record });
  } catch (error) {
    next(error);
  }
};

export const updateLMCWork = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const schema = z.object({
    lmcDate: z.string().nullable().optional(),
    regulatorNo: z.string().nullable().optional(),
    meterSerialNo: z.string().nullable().optional(),
    remarks: z.string().nullable().optional(),
  });

  try {
    const recordId = req.params.recordId as string;
    const data = schema.parse(req.body);

    const updated = await prisma.lMCWork.update({
      where: { id: recordId },
      data: {
        lmcDate: data.lmcDate ? new Date(data.lmcDate) : (data.lmcDate === null ? null : undefined),
        regulatorNo: data.regulatorNo !== undefined ? data.regulatorNo : undefined,
        meterSerialNo: data.meterSerialNo !== undefined ? data.meterSerialNo : undefined,
        remarks: data.remarks !== undefined ? data.remarks : undefined,
        updatedAt: new Date(),
      },
    });

    res.status(200).json({ success: true, record: updated });
  } catch (error) {
    next(error);
  }
};
