/**
 * Utility to compress image files before uploading.
 * High-end mobile cameras (e.g. 48MP/50MP) generate 15MB-50MB photos.
 * Sending raw base64 over cellular data causes HTTP timeouts (timeout of 30000ms exceeded).
 *
 * This function resizes images to max 1280px dimension and converts to 75% quality JPEG.
 * Reduces 15MB photos to ~150KB - 250KB, allowing fast 1-second uploads on mobile.
 *
 * @param {File | Blob | string} fileOrDataUrl - Image file or data URL
 * @param {number} maxDimension - Max width or height in pixels (default: 1280)
 * @param {number} quality - Compression quality between 0.1 and 1.0 (default: 0.75)
 * @returns {Promise<string>} - Compressed JPEG base64 data URL
 */
export function compressImage(fileOrDataUrl, maxDimension = 1280, quality = 0.75) {
  return new Promise((resolve, reject) => {
    if (!fileOrDataUrl) return resolve(null);

    const img = new Image();

    // Setup onload handler
    img.onload = () => {
      try {
        let { width, height } = img;

        // Calculate aspect ratio scale if image exceeds maxDimension
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Canvas context unavailable');
        }

        // Fill canvas with white background to handle transparent PNGs when converting to JPEG
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        // Draw resized image
        ctx.drawImage(img, 0, 0, width, height);

        // Export as JPEG with compression quality
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

        // Cleanup object URL if created
        if (typeof fileOrDataUrl !== 'string' && img.src.startsWith('blob:')) {
          URL.revokeObjectURL(img.src);
        }

        resolve(compressedDataUrl);
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = (err) => {
      if (typeof fileOrDataUrl !== 'string' && img.src.startsWith('blob:')) {
        URL.revokeObjectURL(img.src);
      }
      reject(new Error('Failed to load image for compression'));
    };

    // Load source
    if (typeof fileOrDataUrl === 'string') {
      img.src = fileOrDataUrl;
    } else {
      img.src = URL.createObjectURL(fileOrDataUrl);
    }
  });
}
