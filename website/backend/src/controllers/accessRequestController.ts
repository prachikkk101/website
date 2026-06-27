import { Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../config/db';
import { AuthenticatedRequest } from '../middlewares/auth';
import { Role } from '@prisma/client';

export const createRequest = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const schema = z.object({
    siteId: z.string().uuid(),
  });

  try {
    const { siteId } = schema.parse(req.body);
    const userId = req.user!.id;

    // Check if site exists
    const site = await prisma.site.findUnique({ where: { id: siteId } });
    if (!site) {
      return res.status(404).json({ success: false, error: 'Site not found.' });
    }

    // Check if already assigned
    const existingAssignment = await prisma.siteUser.findUnique({
      where: { userId_siteId: { userId, siteId } },
    });
    if (existingAssignment) {
      return res.status(400).json({ success: false, error: 'You are already assigned to this site.' });
    }

    // Check if pending request exists
    const existingRequest = await prisma.siteAccessRequest.findUnique({
      where: { userId_siteId: { userId, siteId } },
    });
    
    if (existingRequest) {
      if (existingRequest.status === 'PENDING') {
        return res.status(400).json({ success: false, error: 'Access request already pending for this site.' });
      } else if (existingRequest.status === 'APPROVED') {
        return res.status(400).json({ success: false, error: 'Access request already approved.' });
      } else {
        // If rejected previously, allow re-requesting by updating status back to PENDING
        await prisma.siteAccessRequest.update({
          where: { id: existingRequest.id },
          data: { status: 'PENDING' },
        });
        return res.status(200).json({ success: true, message: 'Access request re-submitted successfully.' });
      }
    }

    const newRequest = await prisma.siteAccessRequest.create({
      data: {
        userId,
        siteId,
        status: 'PENDING',
      },
    });

    res.status(201).json({ success: true, message: 'Access request submitted successfully.', request: newRequest });
  } catch (error) {
    next(error);
  }
};

export const listRequests = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string | undefined;

    const whereClause: any = {};
    if (status) {
      whereClause.status = status.toUpperCase();
    }

    const requests = await prisma.siteAccessRequest.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        site: { select: { id: true, name: true, location: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({ success: true, requests });
  } catch (error) {
    next(error);
  }
};

export const approveRequest = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;

  try {
    const accessRequest = await prisma.siteAccessRequest.findUnique({ where: { id } });
    if (!accessRequest) {
      return res.status(404).json({ success: false, error: 'Request not found.' });
    }

    if (accessRequest.status === 'APPROVED') {
      return res.status(400).json({ success: false, error: 'Request is already approved.' });
    }

    // Transaction to update request and create site assignment
    await prisma.$transaction(async (prismaClient) => {
      await prismaClient.siteAccessRequest.update({
        where: { id },
        data: { status: 'APPROVED' },
      });

      // Upsert SiteUser to ensure it exists
      await prismaClient.siteUser.upsert({
        where: {
          userId_siteId: {
            userId: accessRequest.userId,
            siteId: accessRequest.siteId,
          }
        },
        create: {
          userId: accessRequest.userId,
          siteId: accessRequest.siteId,
        },
        update: {}, // Do nothing if it exists
      });
    });

    res.status(200).json({ success: true, message: 'Request approved and access granted.' });
  } catch (error) {
    next(error);
  }
};

export const rejectRequest = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;

  try {
    const accessRequest = await prisma.siteAccessRequest.findUnique({ where: { id } });
    if (!accessRequest) {
      return res.status(404).json({ success: false, error: 'Request not found.' });
    }

    if (accessRequest.status === 'REJECTED') {
      return res.status(400).json({ success: false, error: 'Request is already rejected.' });
    }

    await prisma.siteAccessRequest.update({
      where: { id },
      data: { status: 'REJECTED' },
    });

    res.status(200).json({ success: true, message: 'Request rejected.' });
  } catch (error) {
    next(error);
  }
};
