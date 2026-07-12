import { Router } from 'express';
import {
  getAdminDashboard,
  getUsers, createUser, updateUser, deleteUser, removeSiteAssignment,
  getWhitelist, addToWhitelist, removeFromWhitelist,
} from '../controllers/adminController';
import { authenticate, requireRole } from '../middlewares/auth';
import { Role } from '@prisma/client';

const router = Router();

const adminOnly = [authenticate, requireRole([Role.ADMIN])];

// Dashboard
router.get('/dashboard', authenticate, getAdminDashboard);

// User management
router.get('/users', ...adminOnly, getUsers);
router.post('/users', ...adminOnly, createUser);
router.patch('/users/:userId', ...adminOnly, updateUser);
router.delete('/users/:userId', ...adminOnly, deleteUser);

// Site assignment management
router.delete('/users/:userId/site-assignment', ...adminOnly, removeSiteAssignment);

// Admin whitelist
router.get('/whitelist', ...adminOnly, getWhitelist);
router.post('/whitelist', ...adminOnly, addToWhitelist);
router.delete('/whitelist/:id', ...adminOnly, removeFromWhitelist);

export default router;
