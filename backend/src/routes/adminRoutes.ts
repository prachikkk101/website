import { Router } from 'express';
import {
  getAdminDashboard,
  getUsers, createUser, updateUser,
  getWhitelist, addToWhitelist, removeFromWhitelist,
} from '../controllers/adminController';
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

export default router;
