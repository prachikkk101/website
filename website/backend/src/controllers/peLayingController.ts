import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import { z } from 'zod';
import prisma from '../config/db';
import { PEStatus } from '@prisma/client';

export const getPELaying = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const siteId = req.params.siteId as string;
    const { status, raBillNo } = req.query;

    const where: any = { siteId };
    if (status) where.status = status as PEStatus;
    if (raBillNo) where.raBillNo = { contains: String(raBillNo), mode: 'insensitive' };

    const records = await prisma.pELaying.findMany({
      where,
      orderBy: { layingDate: 'desc' },
    });

    // Compute cumulative totals
    const totals = records.reduce(
      (acc, r) => ({
        d32oc: acc.d32oc + r.d32oc.toNumber(),
        d32b: acc.d32b + r.d32b.toNumber(),
        d63oc: acc.d63oc + r.d63oc.toNumber(),
        d63b: acc.d63b + r.d63b.toNumber(),
        d63hdd: acc.d63hdd + r.d63hdd.toNumber(),
        d90tot: acc.d90tot + r.d90tot.toNumber(),
        d125tot: acc.d125tot + r.d125tot.toNumber(),
      }),
      { d32oc: 0, d32b: 0, d63oc: 0, d63b: 0, d63hdd: 0, d90tot: 0, d125tot: 0 }
    );

    res.status(200).json({ success: true, records, totals });
  } catch (error) {
    next(error);
  }
};

export const createPELaying = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const schema = z.object({
    layingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    testingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    chargingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    raBillNo: z.string().optional(),
    reportNo: z.string().optional(),
    status: z.nativeEnum(PEStatus).default(PEStatus.LAYING),
    area: z.string().min(1),
    coilNo: z.string().min(1),
    d32oc: z.number().nonnegative().default(0),
    d32b: z.number().nonnegative().default(0),
    d63oc: z.number().nonnegative().default(0),
    d63b: z.number().nonnegative().default(0),
    d63hdd: z.number().nonnegative().default(0),
    d90tot: z.number().nonnegative().default(0),
    d125tot: z.number().nonnegative().default(0),
  });

  try {
    const siteId = req.params.siteId as string;
    const data = schema.parse(req.body);

    const record = await prisma.pELaying.create({
      data: {
        siteId,
        ...data,
        layingDate: new Date(data.layingDate),
        testingDate: data.testingDate ? new Date(data.testingDate) : null,
        chargingDate: data.chargingDate ? new Date(data.chargingDate) : null,
      },
    });

    res.status(201).json({ success: true, record });
  } catch (error) {
    next(error);
  }
};

export const updatePELaying = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const schema = z.object({
    testingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    chargingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    raBillNo: z.string().optional(),
    reportNo: z.string().optional(),
    status: z.nativeEnum(PEStatus).optional(),
  });

  try {
    const recordId = req.params.recordId as string;
    const data = schema.parse(req.body);

    const updated = await prisma.pELaying.update({
      where: { id: recordId },
      data: {
        ...data,
        testingDate: data.testingDate ? new Date(data.testingDate) : undefined,
        chargingDate: data.chargingDate ? new Date(data.chargingDate) : undefined,
        updatedAt: new Date(),
      },
    });

    res.status(200).json({ success: true, record: updated });
  } catch (error) {
    next(error);
  }
};
