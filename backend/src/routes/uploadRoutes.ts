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
    // ── STEP 2 DIAGNOSTIC LOGGING ────────────────────────────
    console.log('🔵 [upload] Request received —', new Date().toISOString());
    console.log('🔵 [upload] User:', (req as any).user?.id, '| Role:', (req as any).user?.role);
    console.log('🔵 [upload] Content-Type header:', req.headers['content-type']);
    console.log('🔵 [upload] Body keys:', Object.keys(req.body || {}));
    const dataField = req.body?.data;
    console.log('🔵 [upload] data field type:', typeof dataField, '| length:', typeof dataField === 'string' ? dataField.length : 'N/A');
    console.log('🔵 [upload] R2 env check:', {
      hasAccessKey:  !!process.env.R2_ACCESS_KEY_ID,
      hasSecretKey:  !!process.env.R2_SECRET_ACCESS_KEY,
      hasEndpoint:   !!process.env.R2_ENDPOINT,
      hasBucket:     !!process.env.R2_BUCKET_NAME,
      hasPublicUrl:  !!process.env.R2_PUBLIC_URL,
      endpoint:      process.env.R2_ENDPOINT || '(NOT SET)',
      bucket:        process.env.R2_BUCKET_NAME || '(NOT SET)',
      publicUrlBase: process.env.R2_PUBLIC_URL || '(NOT SET)',
    });
    // ── END DIAGNOSTIC LOGGING ───────────────────────────────

    try {
      const { data, filename } = req.body as { data?: string; filename?: string };

      if (!data || typeof data !== 'string') {
        console.error('❌ [upload] Missing or invalid data field. Body:', JSON.stringify(req.body).slice(0, 200));
        return res.status(400).json({ success: false, error: 'Missing base64 data field' });
      }

      // Derive extension from MIME type in data URL, fall back to jpg
      const mimeMatch = data.match(/^data:([^;]+);base64,/);
      if (!mimeMatch) {
        console.error('❌ [upload] data field is not a valid base64 data URL. First 100 chars:', data.slice(0, 100));
        return res.status(400).json({ success: false, error: 'data field must be a base64 data URL (data:image/...;base64,...)' });
      }
      const mime = mimeMatch[1];
      const ext = mime.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';

      // Build a unique key in the bucket, namespaced by upload type hint
      const safeName = (filename || 'photo')
        .replace(/\.[^.]+$/, '')           // strip extension from hint
        .replace(/[^a-z0-9_\-]/gi, '_')   // sanitise
        .slice(0, 60);
      const key = `uploads/${safeName}_${crypto.randomUUID()}.${ext}`;

      const sizeKB = Math.round(data.length * 0.75 / 1024);
      console.log('🔵 [upload] Uploading to R2 —', { key, mime, sizeKB: `${sizeKB} KB` });

      const url = await uploadToR2(data, key);
      console.log('🟢 [upload] Success — public URL:', url);

      return res.status(201).json({ success: true, url });
    } catch (err: any) {
      // Return the REAL error message so the frontend can show it
      const errMsg = err?.message || String(err);
      const errCode = err?.Code || err?.code || err?.$metadata?.httpStatusCode || 'UNKNOWN';
      console.error('❌ [upload] Handler error — code:', errCode, '| message:', errMsg);
      console.error('❌ [upload] Full error object:', JSON.stringify({
        message: err.message,
        code: err.Code || err.code,
        httpStatusCode: err.$metadata?.httpStatusCode,
        name: err.name,
      }));
      // Pass to global error handler but also send real message directly
      return res.status(500).json({
        success: false,
        error: errMsg,
        code: errCode,
      });
    }
  },
);

export default router;
