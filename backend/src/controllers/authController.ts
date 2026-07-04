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

    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: assignedRole,
        // Auto-verify email: email service is not yet active.
        // Users still need admin to assign them to a site before they can access data.
        emailVerified: true,
        verificationCode: null,
        verificationExpiry: null,
      },
    });

    console.log(`[register] New user registered: ${email} (role: ${assignedRole})`);

    res.status(201).json({
      success: true,
      requiresApproval: true, // frontend shows "waiting for admin" message
      message: assignedRole === Role.ADMIN
        ? 'Admin account created. You can now sign in.'
        : 'Registration successful! Your account is now active. Please ask your administrator to assign you to a site.',
      userId: user.id,
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

    console.log(`[login] Attempt: ${email}`);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.log(`[login] Failed: user not found for ${email}`);
      return res.status(400).json({ success: false, error: 'Invalid credentials' });
    }

    console.log(`[login] User found: ${email} | role: ${user.role} | verified: ${user.emailVerified}`);

    if (!user.emailVerified) {
      console.log(`[login] Blocked: email not verified for ${email}`);
      return res.status(400).json({ success: false, error: 'Email not verified. Please contact your administrator.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    console.log(`[login] Password match: ${isMatch} for ${email}`);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: 'Invalid credentials' });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Fetch the user's assigned site (supervisors have one; admins have none in SiteUser)
    const assignment = await prisma.siteUser.findFirst({
      where: { userId: user.id },
      include: { site: { select: { id: true, name: true } } },
    });

    console.log(`[login] Success: ${email} | site: ${assignment?.site?.name ?? 'none'}`);

    res.status(200).json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        siteId:   assignment?.site?.id   ?? null,
        siteName: assignment?.site?.name ?? null,
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

    // Convenience shortcut: first assigned site
    const firstSite = user?.assignedSites?.[0]?.site ?? null;

    res.status(200).json({
      success: true,
      user: {
        ...user,
        siteId:   firstSite?.id   ?? null,
        siteName: firstSite?.name ?? null,
      },
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
