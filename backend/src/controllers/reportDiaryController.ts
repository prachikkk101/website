import { Response, NextFunction } from 'express';
import prisma from '../config/db';
import { AuthenticatedRequest } from '../middlewares/auth';

export const getDailyReports = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const reports = await prisma.dailyReport.findMany({
      orderBy: { postedAt: 'desc' },
    });
    res.status(200).json({ success: true, reports });
  } catch (error) {
    next(error);
  }
};

export const createDailyReport = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { siteName, date, workDone, issues } = req.body;
    if (!siteName || !date || !workDone) {
      return res.status(400).json({ success: false, error: 'Site name, date, and work done are required' });
    }

    const postedBy = req.user?.email || 'Admin';

    const report = await prisma.dailyReport.create({
      data: {
        siteName,
        date,
        workDone,
        issues: issues || null,
        postedBy,
      },
    });

    res.status(201).json({ success: true, report });
  } catch (error) {
    next(error);
  }
};

export const deleteDailyReport = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    await prisma.dailyReport.delete({
      where: { id },
    });
    res.status(200).json({ success: true, message: 'Daily report deleted successfully' });
  } catch (error) {
    next(error);
  }
};
