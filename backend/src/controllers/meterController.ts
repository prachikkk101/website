import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import { z } from 'zod';
import prisma from '../config/db';

export const getMeters = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const siteId = req.params.siteId;
    const { status, source } = req.query;

    const where: any = { siteId };
    if (status) where.status = String(status);
    if (source) where.source = String(source);

    const meters = await prisma.meterRegister.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({ success: true, meters });
  } catch (error) {
    next(error);
  }
};

export const receiveMeterFromAGP = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const schema = z.object({
    serialNo: z.string().min(1),
    source: z.string().default('AGP'),
  });

  try {
    const siteId = req.params.siteId as string;
    const data = schema.parse(req.body);

    const existing = await prisma.meterRegister.findUnique({ where: { serialNo: data.serialNo } });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Meter serial number already registered' });
    }

    const meter = await prisma.meterRegister.create({
      data: {
        siteId,
        serialNo: data.serialNo,
        source: data.source,
        status: 'Available',
      },
    });

    res.status(201).json({ success: true, meter });
  } catch (error) {
    next(error);
  }
};

export const issueMeterToPlumber = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const schema = z.object({
    serialNo: z.string().min(1),
    plumberName: z.string().min(1),
  });

  try {
    const siteId = req.params.siteId as string;
    const data = schema.parse(req.body);

    const meter = await prisma.meterRegister.findUnique({ where: { serialNo: data.serialNo } });
    if (!meter) {
      return res.status(404).json({ success: false, error: 'Meter not found in register' });
    }

    if (meter.siteId !== siteId) {
      return res.status(403).json({ success: false, error: 'Meter does not belong to this site' });
    }

    if (meter.status !== 'Available') {
      return res.status(400).json({ success: false, error: `Meter cannot be issued. Current status: ${meter.status}` });
    }

    const updated = await prisma.meterRegister.update({
      where: { serialNo: data.serialNo },
      data: {
        issuedToName: data.plumberName,
        status: 'Issued',
      },
    });

    res.status(200).json({ success: true, meter: updated });
  } catch (error) {
    next(error);
  }
};
