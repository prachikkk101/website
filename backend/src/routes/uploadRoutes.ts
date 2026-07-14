/**
 * uploadRoutes.ts — POST /api/uploads/photo
 *
 * Authenticated endpoint. Accepts a base64 data URL + a filename hint,
 * uploads to Cloudflare R2 via the r2Upload utility, and returns the
 * public URL. Frontend uses this for ALL photo uploads (PE Laying DPR,
 * Inventory Challan, PNG Connection house photos) so photos are never
 * stored as base64 blobs in the database.
 */

import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthenticatedRequest } from '../middlewares/auth';
import { uploadToR2 } from '../utils/r2Upload';
import crypto from 'crypto';

const router = Router();

/**
 * POST /api/uploads/photo
 * Body: { data: string (base64 dataURL), filename?: string }
 * Returns: { success: true, url: string }
 */
router.post(
  '/photo',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { data, filename } = req.body as { data?: string; filename?: string };

      if (!data || typeof data !== 'string') {
        return res.status(400).json({ success: false, error: 'Missing base64 data field' });
      }

      // Derive extension from MIME type in data URL, fall back to jpg
      const mimeMatch = data.match(/^data:([^;]+);base64,/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const ext = mime.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';

      // Build a unique key in the bucket, namespaced by upload type hint
      const safeName = (filename || 'photo')
        .replace(/\.[^.]+$/, '')           // strip extension from hint
        .replace(/[^a-z0-9_\-]/gi, '_')   // sanitise
        .slice(0, 60);
      const key = `uploads/${safeName}_${crypto.randomUUID()}.${ext}`;

      console.log('🔵 Upload request:', { key, mime, sizeKB: Math.round(data.length * 0.75 / 1024) });

      const url = await uploadToR2(data, key);

      return res.status(201).json({ success: true, url });
    } catch (err: any) {
      console.error('❌ Upload handler error:', err.message, err);
      next(err);
    }
  },
);

export default router;
