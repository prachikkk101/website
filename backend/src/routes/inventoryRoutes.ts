import { Router } from 'express';
import {
  getConsumptionLogs,
  submitConsumptionLog,
  getPEReturns,
  submitPEReturn,
  getGIReturns,
  submitGIReturn,
  getToolReturns,
  submitToolReturn,
} from '../controllers/inventoryController';
import { authenticate } from '../middlewares/auth';
import { checkSiteAccess } from '../middlewares/checkSiteAccess';

const router = Router({ mergeParams: true });

// Daily Consumption
router.get('/consumption', authenticate, checkSiteAccess, getConsumptionLogs);
router.post('/consumption', authenticate, checkSiteAccess, submitConsumptionLog);

// PE Returns
router.get('/returns/pe', authenticate, checkSiteAccess, getPEReturns);
router.post('/returns/pe', authenticate, checkSiteAccess, submitPEReturn);

// GI Returns
router.get('/returns/gi', authenticate, checkSiteAccess, getGIReturns);
router.post('/returns/gi', authenticate, checkSiteAccess, submitGIReturn);

// Tool Returns
router.get('/tool-returns', authenticate, checkSiteAccess, getToolReturns);
router.post('/tool-returns', authenticate, checkSiteAccess, submitToolReturn);

export default router;
