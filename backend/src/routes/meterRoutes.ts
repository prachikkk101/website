import { Router } from 'express';
import { getMeters, receiveMeterFromAGP, issueMeterToPlumber } from '../controllers/meterController';
import { authenticate, requireRole } from '../middlewares/auth';
import { checkSiteAccess } from '../middlewares/checkSiteAccess';
import { Role } from '@prisma/client';

const router = Router({ mergeParams: true });

router.get('/', authenticate, checkSiteAccess, getMeters);
router.post('/receive', authenticate, requireRole([Role.ADMIN, Role.SUPERVISOR]), receiveMeterFromAGP);
router.post('/issue', authenticate, requireRole([Role.ADMIN, Role.SUPERVISOR]), issueMeterToPlumber);

export default router;
