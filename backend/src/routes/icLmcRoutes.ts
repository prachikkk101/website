import { Router } from 'express';
import {
  getICWork, createICWork, updateICWork,
  getLMCWork, createLMCWork, updateLMCWork,
} from '../controllers/icLmcController';
import { authenticate, requireRole } from '../middlewares/auth';
import { checkSiteAccess } from '../middlewares/checkSiteAccess';
import { Role } from '@prisma/client';

const router = Router({ mergeParams: true });

// I&C Work
router.get('/ic', authenticate, checkSiteAccess, getICWork);
router.post('/ic', authenticate, requireRole([Role.ADMIN, Role.SUPERVISOR]), createICWork);
router.patch('/ic/:recordId', authenticate, requireRole([Role.ADMIN, Role.SUPERVISOR]), updateICWork);

// LMC Work
router.get('/lmc', authenticate, checkSiteAccess, getLMCWork);
router.post('/lmc', authenticate, checkSiteAccess, createLMCWork);
router.patch('/lmc/:recordId', authenticate, checkSiteAccess, updateLMCWork);

export default router;
