import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodIssue } from 'zod';

export interface CustomError extends Error {
  statusCode?: number;
  code?: string; // Prisma error codes
}

export const errorHandler = (
  err: CustomError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
) => {
  // Zod validation errors → 400
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      details: err.issues.map((e: ZodIssue) => ({ field: e.path.join('.'), message: e.message })),
    });
  }

  // Prisma known errors
  if (err.code === 'P2025') {
    // Record not found (e.g. update/delete on non-existent record)
    return res.status(404).json({ success: false, error: 'Record not found' });
  }
  if (err.code === 'P2002') {
    // Unique constraint violation
    return res.status(409).json({ success: false, error: 'A record with that value already exists' });
  }

  console.error('[Error]', err.code || '', err.message, err.stack ? '\n' + err.stack : '');

  const statusCode = err.statusCode || 500;
  const message = statusCode === 500 ? 'Internal Server Error' : (err.message || 'Internal Server Error');

  res.status(statusCode).json({
    success: false,
    error: message,
  });
};
