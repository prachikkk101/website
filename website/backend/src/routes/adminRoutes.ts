import { Router } from 'express';
import {
  getAdminDashboard,
  getUsers, createUser, updateUser,
  getWhitelist, addToWhitelist, removeFromWhitelist,
} from '../controllers/adminController';
import { listRequests, approveRequest, rejectRequest } from '../controllers/accessRequestController';
import { authenticate, requireRole } from '../middlewares/auth';
import { Role } from '@prisma/client';

const router = Router();

const adminOnly = [authenticate, requireRole([Role.ADMIN])];

// Dashboard
router.get('/dashboard', ...adminOnly, getAdminDashboard);

// User management
router.get('/users', ...adminOnly, getUsers);
router.post('/users', ...adminOnly, createUser);
router.patch('/users/:userId', ...adminOnly, updateUser);

// Admin whitelist
router.get('/whitelist', ...adminOnly, getWhitelist);
router.post('/whitelist', ...adminOnly, addToWhitelist);
router.delete('/whitelist/:id', ...adminOnly, removeFromWhitelist);

// Access Requests
router.get('/access-requests', ...adminOnly, listRequests);
router.post('/access-requests/:id/approve', ...adminOnly, approveRequest);
router.post('/access-requests/:id/reject', ...adminOnly, rejectRequest);

export default router;
