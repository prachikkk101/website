import { Router } from 'express';
import {
  getPNGConnections,
  createPNGConnection,
  updatePNGConnection,
  deletePNGConnection,
  submitMeterInstallation,
} from '../controllers/pngController';
import { authenticate, requireRole } from '../middlewares/auth';
import { checkSiteAccess } from '../middlewares/checkSiteAccess';
import { Role } from '@prisma/client';

const router = Router({ mergeParams: true }); // mergeParams allows :siteId from parent router

router.get('/', authenticate, checkSiteAccess, getPNGConnections);
router.post('/', authenticate, checkSiteAccess, createPNGConnection);
router.patch('/:connectionId', authenticate, checkSiteAccess, updatePNGConnection);
router.delete(
  '/:connectionId',
  authenticate,
  requireRole([Role.ADMIN, Role.SUPERVISOR]),
  deletePNGConnection
);
router.post(
  '/:connectionId/meter',
  authenticate,
  requireRole([Role.ADMIN, Role.SUPERVISOR]),
  submitMeterInstallation
);

export default router;
