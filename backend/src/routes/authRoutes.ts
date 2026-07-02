import { Router } from 'express';
import {
  register,
  verifyEmail,
  login,
  refresh,
  me,
  adminForgotPassword,
  adminVerifyResetOtp,
  adminResetPassword,
  changePassword,
} from '../controllers/authController';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.post('/register', register);
router.post('/verify-email', verifyEmail);
router.post('/login', login);
router.post('/refresh', refresh);
router.get('/me', authenticate, me);

// Admin forgot-password OTP flow
router.post('/admin/forgot-password', adminForgotPassword);
router.post('/admin/verify-reset-otp', adminVerifyResetOtp);
router.post('/admin/reset-password', adminResetPassword);

// Change password while logged in (any role)
router.post('/change-password', authenticate, changePassword);

export default router;
