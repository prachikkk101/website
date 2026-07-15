import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import siteRoutes from './routes/siteRoutes';
import pngRoutes from './routes/pngRoutes';
import inventoryRoutes from './routes/inventoryRoutes';
import stockRoutes from './routes/stockRoutes';
import peLayingRoutes from './routes/peLayingRoutes';
import icLmcRoutes from './routes/icLmcRoutes';
import meterRoutes from './routes/meterRoutes';
import reportRoutes from './routes/reportRoutes';
import adminRoutes from './routes/adminRoutes';
import uploadRoutes from './routes/uploadRoutes';
import { errorHandler } from './middlewares/error';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// ── Middleware ────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173', // vite preview
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow all Vercel deployments
    if (!origin || origin.includes('vercel.app') || origin.includes('localhost')) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// ── Health Check ──────────────────────────────────────────
app.get('/health', (_req: import('express').Request, res: import('express').Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get('/api/health', (_req: import('express').Request, res: import('express').Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

import { authenticate } from './middlewares/auth';
import { getGALocations, getCities, getAreas, getStockCategories } from './controllers/siteController';
import { getDailyReports, createDailyReport, deleteDailyReport } from './controllers/reportDiaryController';

// ── Routes ────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/reports', reportRoutes);
app.use('/api/sites', siteRoutes);

app.get('/api/ga-locations', authenticate, getGALocations);
app.get('/api/cities', authenticate, getCities);
app.get('/api/areas', authenticate, getAreas);
app.get('/api/stock-categories', authenticate, getStockCategories);

app.get('/api/daily-reports', authenticate, getDailyReports);
app.post('/api/daily-reports', authenticate, createDailyReport);
app.delete('/api/daily-reports/:id', authenticate, deleteDailyReport);

// Photo uploads — POST /api/uploads/photo (base64 JSON) → uploads to Cloudflare R2
app.use('/api/uploads', uploadRoutes);

// POST /api/upload — multipart/form-data alias (file field + optional folder field)
// Used as an alternative to the base64 JSON upload — accepts actual file binary.
import multer from 'multer';
import { uploadToR2 } from './utils/r2Upload';
import crypto from 'crypto';
const _multerUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
app.post(
  '/api/upload',
  authenticate,
  _multerUpload.single('file'),
  async (req: any, res: import('express').Response, next: import('express').NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file provided' });
      }
      const folder = (req.body?.folder as string) || 'uploads';
      const ext = req.file.mimetype.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
      const key = `${folder}/${crypto.randomUUID()}.${ext}`;
      console.log('🔵 Multipart upload:', { key, mime: req.file.mimetype, sizeKB: Math.round(req.file.size / 1024) });
      const url = await uploadToR2(req.file.buffer, key);
      return res.status(201).json({ success: true, url });
    } catch (err: any) {
      console.error('❌ Multipart upload handler error:', err.message);
      next(err);
    }
  }
);

// Site-scoped sub-routes (use :siteId as param prefix)
app.use('/api/sites/:siteId/png-connections', pngRoutes);
app.use('/api/sites/:siteId/inventory', stockRoutes);
app.use('/api/sites/:siteId/pe-laying', peLayingRoutes);
app.use('/api/sites/:siteId/meters', meterRoutes);
// ic and lmc must come before the generic inventoryRoutes catch-all
app.use('/api/sites/:siteId', icLmcRoutes);
app.use('/api/sites/:siteId', inventoryRoutes);

// ── Global Error Handler ──────────────────────────────────
app.use(errorHandler);

// ── Start Server ──────────────────────────────────────────
app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`\n🔥 GP-PMS Backend running on http://0.0.0.0:${PORT}`);
  console.log(`📋 Health check: http://0.0.0.0:${PORT}/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

export default app;
