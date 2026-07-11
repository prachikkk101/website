import { Router } from 'express';
import { getSites, createSite, getSiteById, assignWorker, getSiteStock, receiveStock, deleteSite, deleteCity, deleteGALocation, updateSite } from '../controllers/siteController';
import { authenticate, requireRole } from '../middlewares/auth';
import { checkSiteAccess } from '../middlewares/checkSiteAccess';
import { Role } from '@prisma/client';

const router = Router();

router.get('/', authenticate, getSites);
router.post('/', authenticate, requireRole([Role.ADMIN]), createSite);

// Specific named-segment routes MUST come before the /:id wildcard
// otherwise Express matches "city" / "ga" as the :id param value
router.delete('/city/:gaName/:location', authenticate, requireRole([Role.ADMIN]), deleteCity);
router.delete('/ga/:gaName', authenticate, requireRole([Role.ADMIN]), deleteGALocation);

router.get('/:id', authenticate, checkSiteAccess, getSiteById);
router.patch('/:id', authenticate, requireRole([Role.ADMIN]), updateSite);
router.delete('/:id', authenticate, requireRole([Role.ADMIN]), deleteSite);
router.post('/:id/workers', authenticate, requireRole([Role.ADMIN]), assignWorker);
router.get('/:id/stock', authenticate, checkSiteAccess, getSiteStock);
router.post('/:id/stock/receive', authenticate, requireRole([Role.ADMIN]), receiveStock);

export default router;


