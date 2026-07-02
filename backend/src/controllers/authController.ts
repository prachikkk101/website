import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import prisma from '../config/db';
import { Role } from '@prisma/client';
import { AuthenticatedRequest } from '../middlewares/auth';
import {
  sendPasswordResetOTP,
  sendPasswordChangedNotification,
} from '../utils/email';

const JWT_SECRET = process.env.JWT_SECRET || 'gp-pms-super-secret-access-token-key-2026';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'gp-pms-super-secret-refresh-token-key-2026';

const generateAccessToken = (user: { id: string; email: string; role: Role }) => {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, {
    expiresIn: '15m',
  });
};

const generateRefreshToken = (user: { id: string; email: string; role: Role }) => {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_REFRESH_SECRET, {
    expiresIn: '30d',
  });
};

export const register = async (req: Request, res: Response, next: NextFunction) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string().min(1),
  });

  try {
    const { email, password, name } = schema.parse(req.body);

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'Email already registered' });
    }

    // Check if whitelisted for Admin
    const isWhitelisted = await prisma.adminWhitelist.findUnique({ where: { email } });
    const assignedRole = isWhitelisted ? Role.ADMIN : Role.WORKER;

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Generate random 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: assignedRole,
        verificationCode: code,
        verificationExpiry,
      },
    });

    // TODO: Send email with code if email service is available
    // await sendVerificationEmail(email, code);

    res.status(201).json({
      success: true,
      message: 'Registration successful. Use this code to verify: ' + code,
      userId: user.id,
      verificationCode: code, // For testing only - remove in production
    });
  } catch (error) {
    next(error);
  }
};

export const verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
  const schema = z.object({
    email: z.string().email(),
    code: z.string().length(6),
  });

  try {
    const { email, code } = schema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ success: false, error: 'Email already verified' });
    }

    if (user.verificationCode !== code) {
      return res.status(400).json({ success: false, error: 'Invalid verification code' });
    }

    if (user.verificationExpiry && user.verificationExpiry < new Date()) {
      return res.status(400).json({ success: false, error: 'Code has expired' });
    }

    // Mark verified
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationCode: null,
        verificationExpiry: null,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Email verified successfully. You can now login.',
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string(),
  });

  try {
    const { email, password } = schema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ success: false, error: 'Invalid credentials' });
    }

    if (!user.emailVerified) {
      return res.status(400).json({ success: false, error: 'Email not verified. Please verify first.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: 'Invalid credentials' });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.status(200).json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const refresh = async (req: Request, res: Response, next: NextFunction) => {
  const schema = z.object({
    refreshToken: z.string(),
  });

  try {
    const { refreshToken } = schema.parse(req.body);
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as {
      id: string;
      email: string;
      role: Role;
    };

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) {
      return res.status(400).json({ success: false, error: 'Invalid session' });
    }

    const newAccessToken = generateAccessToken(user);
    res.status(200).json({
      success: true,
      accessToken: newAccessToken,
    });
  } catch (error) {
    res.status(401).json({ success: false, error: 'Session expired' });
  }
};

export const me = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        assignedSites: {
          include: {
            site: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
};


/* ══════════════════════════════════════════════════
   ADMIN FORGOT PASSWORD — OTP-BASED RESET FLOW
══════════════════════════════════════════════════ */

const RESET_JWT_SECRET = process.env.JWT_SECRET || 'gp-pms-super-secret-access-token-key-2026';
const GENERIC_RESET_MSG = 'If this email is registered as an admin, an OTP has been sent.';

export const adminForgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  const schema = z.object({ email: z.string().email() });

  try {
    const { email } = schema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });

    // Security: always return same generic message — don't reveal if email exists
    if (!user || user.role !== Role.ADMIN) {
      return res.status(200).json({ success: true, message: GENERIC_RESET_MSG });
    }

    // Invalidate any previous unused OTPs for this email
    await prisma.passwordResetOTP.updateMany({
      where: { email, used: false },
      data: { used: true },
    });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await prisma.passwordResetOTP.create({
      data: { email, otp, expiresAt },
    });

    await sendPasswordResetOTP(email, otp);

    return res.status(200).json({ success: true, message: GENERIC_RESET_MSG });
  } catch (error) {
    next(error);
  }
};

export const adminVerifyResetOtp = async (req: Request, res: Response, next: NextFunction) => {
  const schema = z.object({
    email: z.string().email(),
    otp: z.string().length(6),
  });

  try {
    const { email, otp } = schema.parse(req.body);

    const record = await prisma.passwordResetOTP.findFirst({
      where: {
        email,
        otp,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      return res.status(400).json({ success: false, error: 'Invalid or expired OTP' });
    }

    // Mark OTP as used
    await prisma.passwordResetOTP.update({
      where: { id: record.id },
      data: { used: true },
    });

    // Issue short-lived reset token (10 min)
    const resetToken = jwt.sign(
      { email, purpose: 'password-reset' },
      RESET_JWT_SECRET,
      { expiresIn: '10m' }
    );

    return res.status(200).json({ success: true, resetToken });
  } catch (error) {
    next(error);
  }
};

export const adminResetPassword = async (req: Request, res: Response, next: NextFunction) => {
  const schema = z.object({
    resetToken: z.string(),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  });

  try {
    const { resetToken, newPassword } = schema.parse(req.body);

    // Verify reset token
    let decoded: { email: string; purpose: string };
    try {
      decoded = jwt.verify(resetToken, RESET_JWT_SECRET) as { email: string; purpose: string };
    } catch {
      return res.status(400).json({ success: false, error: 'Invalid or expired reset token' });
    }

    if (decoded.purpose !== 'password-reset') {
      return res.status(400).json({ success: false, error: 'Invalid reset token' });
    }

    const user = await prisma.user.findUnique({ where: { email: decoded.email } });
    if (!user || user.role !== Role.ADMIN) {
      return res.status(400).json({ success: false, error: 'Invalid reset token' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    await sendPasswordChangedNotification(user.email);

    return res.status(200).json({ success: true, message: 'Password reset successfully. You can now login.' });
  } catch (error) {
    next(error);
  }
};

/* ══════════════════════════════════════════════════
   CHANGE PASSWORD (WHILE LOGGED IN) — ANY ROLE
══════════════════════════════════════════════════ */

export const changePassword = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const schema = z.object({
    currentPassword: z.string(),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  });

  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { currentPassword, newPassword } = schema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: 'Current password is incorrect' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    if (user.role === Role.ADMIN) {
      await sendPasswordChangedNotification(user.email);
    }

    return res.status(200).json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
};
