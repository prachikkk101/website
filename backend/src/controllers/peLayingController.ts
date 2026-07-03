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
    layingDate: z.string(),
    testingDate: z.string().nullable().optional(),
    chargingDate: z.string().nullable().optional(),
    raBillNo: z.string().nullable().optional(),
    reportNo: z.string().nullable().optional(),
    status: z.nativeEnum(PEStatus).nullable().optional(),
    area: z.string().min(1),
    coilNo: z.string().nullable().optional(),
    d32oc: z.number().nonnegative().nullable().optional(),
    d32b: z.number().nonnegative().nullable().optional(),
    d63oc: z.number().nonnegative().nullable().optional(),
    d63b: z.number().nonnegative().nullable().optional(),
    d63hdd: z.number().nonnegative().nullable().optional(),
    d90tot: z.number().nonnegative().nullable().optional(),
    d125tot: z.number().nonnegative().nullable().optional(),
  });

  try {
    const siteId = req.params.siteId as string;
    const data = schema.parse(req.body);

    const record = await prisma.pELaying.create({
      data: {
        siteId,
        layingDate: new Date(data.layingDate),
        testingDate: data.testingDate ? new Date(data.testingDate) : null,
        chargingDate: data.chargingDate ? new Date(data.chargingDate) : null,
        raBillNo: data.raBillNo || null,
        reportNo: data.reportNo || null,
        status: data.status || PEStatus.LAYING,
        area: data.area,
        coilNo: data.coilNo || "",
        d32oc: data.d32oc ?? 0,
        d32b: data.d32b ?? 0,
        d63oc: data.d63oc ?? 0,
        d63b: data.d63b ?? 0,
        d63hdd: data.d63hdd ?? 0,
        d90tot: data.d90tot ?? 0,
        d125tot: data.d125tot ?? 0,
      },
    });

    res.status(201).json({ success: true, record });
  } catch (error) {
    next(error);
  }
};

export const updatePELaying = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const schema = z.object({
    testingDate: z.string().nullable().optional(),
    chargingDate: z.string().nullable().optional(),
    raBillNo: z.string().nullable().optional(),
    reportNo: z.string().nullable().optional(),
    status: z.nativeEnum(PEStatus).nullable().optional(),
  });

  try {
    const recordId = req.params.recordId as string;
    const data = schema.parse(req.body);

    const updated = await prisma.pELaying.update({
      where: { id: recordId },
      data: {
        testingDate: data.testingDate ? new Date(data.testingDate) : (data.testingDate === null ? null : undefined),
        chargingDate: data.chargingDate ? new Date(data.chargingDate) : (data.chargingDate === null ? null : undefined),
        raBillNo: data.raBillNo !== undefined ? data.raBillNo : undefined,
        reportNo: data.reportNo !== undefined ? data.reportNo : undefined,
        status: data.status !== undefined && data.status !== null ? data.status : undefined,
        updatedAt: new Date(),
      },
    });

    res.status(200).json({ success: true, record: updated });
  } catch (error) {
    next(error);
  }
};
