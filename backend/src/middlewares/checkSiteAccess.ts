import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import prisma from '../config/db';
import { Role } from '@prisma/client';

export const checkSiteAccess = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  // Admins bypass all site checks
  if (req.user.role === Role.ADMIN) {
    return next();
  }

  // ── READ-ONLY requests: any authenticated user can read shared site data ──
  // Data is already scoped to the siteId in the URL; no membership check needed.
  // This allows supervisors/workers who haven't been explicitly added to SiteUser
  // to still view the shared project data.
  if (req.method === 'GET') {
    return next();
  }

  // ── MUTATION requests (POST, PUT, PATCH, DELETE): require site membership ──
  const siteId = req.params.siteId || req.params.id || req.body.siteId || req.query.siteId;

  if (!siteId || typeof siteId !== 'string') {
    return res.status(400).json({ success: false, error: 'Bad Request: Missing Site ID context' });
  }

  try {
    const siteAssignment = await prisma.siteUser.findUnique({
      where: {
        userId_siteId: {
          userId: req.user.id,
          siteId: siteId,
        },
      },
    });

    if (!siteAssignment) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You do not have permission to modify records for this site',
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};
