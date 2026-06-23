import { Router } from 'express';
import { register, verifyEmail, login, refresh, me } from '../controllers/authController';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.post('/register', register);
router.post('/verify-email', verifyEmail);
router.post('/login', login);
router.post('/refresh', refresh);
router.get('/me', authenticate, me);

export default router;
