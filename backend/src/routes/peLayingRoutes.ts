import { Router } from 'express';
import { getPELaying, createPELaying, updatePELaying, deletePELaying } from '../controllers/peLayingController';
import { authenticate, requireRole } from '../middlewares/auth';
import { checkSiteAccess } from '../middlewares/checkSiteAccess';
import { Role } from '@prisma/client';

const router = Router({ mergeParams: true });

router.get('/', authenticate, checkSiteAccess, getPELaying);
router.post('/', authenticate, checkSiteAccess, createPELaying);
// Workers must be able to edit PE Laying entries for their own site (Item 6 fix)
router.patch('/:recordId', authenticate, checkSiteAccess, updatePELaying);
router.delete(
  '/:recordId',
  authenticate,
  requireRole([Role.ADMIN, Role.SUPERVISOR]),
  deletePELaying
);


export default router;
