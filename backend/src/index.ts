import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import siteRoutes from './routes/siteRoutes';
import pngRoutes from './routes/pngRoutes';
import inventoryRoutes from './routes/inventoryRoutes';
import peLayingRoutes from './routes/peLayingRoutes';
import icLmcRoutes from './routes/icLmcRoutes';
import meterRoutes from './routes/meterRoutes';
import reportRoutes from './routes/reportRoutes';
import adminRoutes from './routes/adminRoutes';
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
    // Allow server-to-server requests (no Origin header) and whitelisted origins
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    }
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Health Check ──────────────────────────────────────────
app.get('/health', (_req: import('express').Request, res: import('express').Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get('/api/health', (_req: import('express').Request, res: import('express').Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Routes ────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/reports', reportRoutes);
app.use('/api/sites', siteRoutes);

// Site-scoped sub-routes (use :siteId as param prefix)
app.use('/api/sites/:siteId/png-connections', pngRoutes);
app.use('/api/sites/:siteId', inventoryRoutes);
app.use('/api/sites/:siteId/pe-laying', peLayingRoutes);
app.use('/api/sites/:siteId/meters', meterRoutes);
app.use('/api/sites/:siteId', icLmcRoutes);

// ── Global Error Handler ──────────────────────────────────
app.use(errorHandler);

// ── Start Server ──────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🔥 GP-PMS Backend running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

export default app;
