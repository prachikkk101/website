import { Router } from 'express';
import { getSites, createSite, getSiteById, assignWorker, getSiteStock, receiveStock, deleteSite, deleteCity, deleteGALocation } from '../controllers/siteController';
import { authenticate, requireRole } from '../middlewares/auth';
import { checkSiteAccess } from '../middlewares/checkSiteAccess';
import { Role } from '@prisma/client';

const router = Router();

router.get('/', authenticate, getSites);
router.post('/', authenticate, requireRole([Role.ADMIN]), createSite);
router.get('/:id', authenticate, checkSiteAccess, getSiteById);
router.post('/:id/workers', authenticate, requireRole([Role.ADMIN]), assignWorker);
router.get('/:id/stock', authenticate, checkSiteAccess, getSiteStock);
router.post('/:id/stock/receive', authenticate, requireRole([Role.ADMIN]), receiveStock);

router.delete('/:id', authenticate, requireRole([Role.ADMIN]), deleteSite);
router.delete('/city/:gaName/:location', authenticate, requireRole([Role.ADMIN]), deleteCity);
router.delete('/ga/:gaName', authenticate, requireRole([Role.ADMIN]), deleteGALocation);

export default router;
