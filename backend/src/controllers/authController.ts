import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import prisma from '../config/db';
import { sendVerificationEmail } from '../utils/email';
import { Role } from '@prisma/client';
import { AuthenticatedRequest } from '../middlewares/auth';

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

    await sendVerificationEmail(email, code);

    res.status(201).json({
      success: true,
      message: 'Registration successful. Check your email for verification OTP.',
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
      return res.status(400).json({ success: false, error: 'Invalid verification OTP' });
    }

    if (user.verificationExpiry && user.verificationExpiry < new Date()) {
      return res.status(400).json({ success: false, error: 'OTP has expired' });
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
