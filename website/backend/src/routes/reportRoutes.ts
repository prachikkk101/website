import { Router } from 'express';
import { exportDashboardReport } from '../controllers/reportController';
import { authenticate, requireRole } from '../middlewares/auth';
import { Role } from '@prisma/client';

const router = Router();

router.get('/export', authenticate, requireRole([Role.ADMIN]), exportDashboardReport);

export default router;
