/**
 * r2Upload.ts — Cloudflare R2 upload utility
 *
 * Accepts a base64 data URL string (e.g. "data:image/jpeg;base64,/9j/...")
 * or a raw Buffer, uploads to the configured R2 bucket, and returns the
 * public HTTPS URL of the uploaded object.
 *
 * R2 is S3-compatible — we use the AWS SDK with the Cloudflare R2 endpoint.
 */

import {
  S3Client,
  PutObjectCommand,
} from '@aws-sdk/client-s3';

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT || '',
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID     || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET = process.env.R2_BUCKET_NAME || 'gppms-photos';
const PUBLIC_URL_BASE = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

/**
 * Upload a base64 data URL (or raw Buffer) to Cloudflare R2.
 *
 * @param data     - base64 data URL ("data:image/jpeg;base64,...") or Buffer
 * @param filename - target object key in R2 bucket, e.g. "dpr/uuid.jpg"
 * @returns        - public HTTPS URL of the uploaded object
 */
export async function uploadToR2(
  data: string | Buffer,
  filename: string,
): Promise<string> {
  let buffer: Buffer;
  let contentType = 'image/jpeg';

  if (typeof data === 'string') {
    // Strip data URL prefix: "data:image/png;base64,..."
    const match = data.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      throw new Error('Invalid base64 data URL — expected "data:<mime>;base64,<data>"');
    }
    contentType = match[1]; // e.g. "image/jpeg"
    buffer = Buffer.from(match[2], 'base64');
  } else {
    buffer = data;
  }

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: filename,
    Body: buffer,
    ContentType: contentType,
    // R2 public buckets serve objects via the R2 public URL — no ACL needed
  });

  try {
    await r2.send(command);
  } catch (err: any) {
    console.error('❌ R2 upload failed:', {
      message: err.message,
      code: err.Code || err.code,
      statusCode: err.$metadata?.httpStatusCode,
      bucket: BUCKET,
      key: filename,
      endpoint: process.env.R2_ENDPOINT,
    });
    throw err;
  }

  const publicUrl = `${PUBLIC_URL_BASE}/${filename}`;
  console.log('🟢 R2 upload success:', publicUrl);
  return publicUrl;
}
