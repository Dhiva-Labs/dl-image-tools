/** Convert an image from one format to another at full resolution. */

import { ImageToolsError } from '../utils/errors.js';
import {
  decodeImage,
  canvasFrom,
  canvasToBlob,
  isTypeSupported,
  resolveOutputFormat,
  formatLabel,
} from '../utils/image.js';

const DEFAULT_QUALITY = 0.92;

function clampQuality(quality) {
  const value = Number(quality);
  if (!Number.isFinite(value)) return DEFAULT_QUALITY;
  return Math.min(1, Math.max(0.01, value));
}

/**
 * @param {File|Blob|ImageBitmap} source
 * @param {string} format 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif'
 * @param {number} [quality] 0..1, ignored for PNG
 * @returns {Promise<{blob: Blob, width: number, height: number}>}
 */
export async function convert(source, format, quality = DEFAULT_QUALITY) {
  const bitmap = await decodeImage(source);
  const owned = bitmap !== source;

  try {
    const target = await resolveOutputFormat(source, format);
    if (!(await isTypeSupported(target))) {
      throw new ImageToolsError(
        `Your browser cannot create ${formatLabel(target)} images. Try a different output format.`
      );
    }

    const width = bitmap.width;
    const height = bitmap.height;
    // PNG/WebP/AVIF sources may carry alpha; JPEG cannot, so composite on white
    // first instead of letting transparent pixels turn black.
    const background = target === 'image/jpeg' ? '#ffffff' : null;
    const canvas = canvasFrom(bitmap, width, height, { background });
    const blob = await canvasToBlob(
      canvas,
      target,
      target === 'image/png' ? undefined : clampQuality(quality)
    );

    return { blob, width, height };
  } finally {
    if (owned && typeof bitmap.close === 'function') bitmap.close();
  }
}
