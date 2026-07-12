import { Router } from 'express';
import { getPELaying, createPELaying, updatePELaying, deletePELaying } from '../controllers/peLayingController';
import { authenticate, requireRole } from '../middlewares/auth';
import { checkSiteAccess } from '../middlewares/checkSiteAccess';
import { Role } from '@prisma/client';

const router = Router({ mergeParams: true });

router.get('/', authenticate, checkSiteAccess, getPELaying);
router.post('/', authenticate, checkSiteAccess, createPELaying);
router.patch('/:recordId', authenticate, requireRole([Role.ADMIN, Role.SUPERVISOR]), updatePELaying);
router.delete(
  '/:recordId',
  authenticate,
  requireRole([Role.ADMIN, Role.SUPERVISOR]),
  deletePELaying
);

export default router;
