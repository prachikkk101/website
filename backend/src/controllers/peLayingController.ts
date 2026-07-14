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
  console.log('🔵 PE Laying create — full request body:', JSON.stringify(req.body, null, 2));

  const schema = z.object({
    layingDate: z.string().min(1),
    testingDate: z.string().nullable().optional(),
    chargingDate: z.string().nullable().optional(),
    raBillNo: z.string().nullable().optional(),
    reportNo: z.string().nullable().optional(),
    status: z.nativeEnum(PEStatus).nullable().optional(),
    connType: z.string().nullable().optional(),   // Domestic / Commercial / Industrial
    area: z.string().min(1),
    coilNo: z.string().nullable().optional(),
    d32oc: z.number().nonnegative().nullable().optional(),
    d32b: z.number().nonnegative().nullable().optional(),
    d63oc: z.number().nonnegative().nullable().optional(),
    d63b: z.number().nonnegative().nullable().optional(),
    d63hdd: z.number().nonnegative().nullable().optional(),
    d90tot: z.number().nonnegative().nullable().optional(),
    d125tot: z.number().nonnegative().nullable().optional(),
    // DPR photo — Cloudflare R2 URL uploaded by frontend before save
    dprPhotoUrl: z.string().url().nullable().optional(),
  });

  try {
    const siteId = req.params.siteId as string;

    let data;
    try {
      data = schema.parse(req.body);
      console.log('🟢 PE Laying Zod validation passed. Parsed data:', JSON.stringify(data, null, 2));
    } catch (zodErr: any) {
      console.error('❌ PE Laying Zod validation FAILED:', JSON.stringify(zodErr.errors ?? zodErr, null, 2));
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: zodErr.errors ?? zodErr.message,
      });
    }

    try {
      const record = await prisma.pELaying.create({
        data: {
          siteId,
          layingDate: new Date(data.layingDate),
          testingDate: data.testingDate ? new Date(data.testingDate) : null,
          chargingDate: data.chargingDate ? new Date(data.chargingDate) : null,
          raBillNo: data.raBillNo || null,
          reportNo: data.reportNo || null,
          status: data.status || PEStatus.LAYING,
          connType: data.connType || 'Domestic',
          area: data.area,
          coilNo: data.coilNo || '',
          d32oc: data.d32oc ?? 0,
          d32b: data.d32b ?? 0,
          d63oc: data.d63oc ?? 0,
          d63b: data.d63b ?? 0,
          d63hdd: data.d63hdd ?? 0,
          d90tot: data.d90tot ?? 0,
          d125tot: data.d125tot ?? 0,
          // DPR photo URL (null if none uploaded)
          dprPhotoUrl: data.dprPhotoUrl || null,
        },
      });

      console.log('🟢 PE Laying created successfully. ID:', record.id);
      res.status(201).json({ success: true, record });
    } catch (prismaErr: any) {
      console.error('❌ PE Laying Prisma create FAILED:', prismaErr.message, prismaErr);
      return res.status(500).json({ success: false, error: prismaErr.message });
    }
  } catch (error) {
    next(error);
  }
};


export const updatePELaying = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // Full schema — workers can update all fields of their PE laying entries
  const schema = z.object({
    layingDate: z.string().nullable().optional(),
    testingDate: z.string().nullable().optional(),
    chargingDate: z.string().nullable().optional(),
    raBillNo: z.string().nullable().optional(),
    reportNo: z.string().nullable().optional(),
    status: z.nativeEnum(PEStatus).nullable().optional(),
    connType: z.string().nullable().optional(),
    area: z.string().nullable().optional(),
    // coilNo field is re-labelled "Customer Name" in the UI but stored as coilNo in DB
    coilNo: z.string().nullable().optional(),
    d32oc: z.number().nonnegative().nullable().optional(),
    d32b: z.number().nonnegative().nullable().optional(),
    d63oc: z.number().nonnegative().nullable().optional(),
    d63b: z.number().nonnegative().nullable().optional(),
    d63hdd: z.number().nonnegative().nullable().optional(),
    d90tot: z.number().nonnegative().nullable().optional(),
    d125tot: z.number().nonnegative().nullable().optional(),
    // DPR photo URL update
    dprPhotoUrl: z.string().url().nullable().optional(),
  });

  try {
    const recordId = req.params.recordId as string;
    const data = schema.parse(req.body);

    const updated = await prisma.pELaying.update({
      where: { id: recordId },
      data: {
        ...(data.layingDate ? { layingDate: new Date(data.layingDate) } : {}),
        testingDate: data.testingDate ? new Date(data.testingDate) : (data.testingDate === null ? null : undefined),
        chargingDate: data.chargingDate ? new Date(data.chargingDate) : (data.chargingDate === null ? null : undefined),
        raBillNo: data.raBillNo !== undefined ? data.raBillNo : undefined,
        reportNo: data.reportNo !== undefined ? data.reportNo : undefined,
        status: data.status !== undefined && data.status !== null ? data.status : undefined,
        connType: data.connType !== undefined ? (data.connType ?? undefined) : undefined,
        area: data.area !== undefined ? (data.area ?? undefined) : undefined,
        coilNo: data.coilNo !== undefined ? (data.coilNo ?? '') : undefined,
        d32oc: data.d32oc !== undefined ? (data.d32oc ?? 0) : undefined,
        d32b: data.d32b !== undefined ? (data.d32b ?? 0) : undefined,
        d63oc: data.d63oc !== undefined ? (data.d63oc ?? 0) : undefined,
        d63b: data.d63b !== undefined ? (data.d63b ?? 0) : undefined,
        d63hdd: data.d63hdd !== undefined ? (data.d63hdd ?? 0) : undefined,
        d90tot: data.d90tot !== undefined ? (data.d90tot ?? 0) : undefined,
        d125tot: data.d125tot !== undefined ? (data.d125tot ?? 0) : undefined,
        dprPhotoUrl: data.dprPhotoUrl !== undefined ? data.dprPhotoUrl : undefined,
        updatedAt: new Date(),
      },
    });

    res.status(200).json({ success: true, record: updated });
  } catch (error) {
    next(error);
  }
};


export const deletePELaying = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const recordId = req.params.recordId as string;

    console.log('🔵 Delete request for PE Laying record:', recordId);

    const existing = await prisma.pELaying.findUnique({
      where: { id: recordId },
      select: { id: true, siteId: true, area: true, layingDate: true },
    });

    if (!existing) {
      console.warn('⚠️  PE Laying record not found for delete:', recordId);
      return res.status(404).json({ success: false, error: 'PE Laying record not found' });
    }

    const deleted = await prisma.pELaying.delete({ where: { id: recordId } });

    console.log('🟢 Deleted PE Laying record:', deleted.id, `(area: ${deleted.area})`);

    res.json({ success: true, deletedId: deleted.id });
  } catch (error: any) {
    console.error('❌ Delete PE Laying failed:', error.message);
    next(error);
  }
};
