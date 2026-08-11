/** Re-encode an image at a lower quality without changing its dimensions. */

import { ImageToolsError } from '../utils/errors.js';
import {
  decodeImage,
  canvasFrom,
  canvasToBlob,
  isTypeSupported,
  resolveOutputFormat,
  formatLabel,
} from '../utils/image.js';

const DEFAULT_QUALITY = 0.8;

function clampQuality(quality) {
  const value = Number(quality);
  if (!Number.isFinite(value)) return DEFAULT_QUALITY;
  return Math.min(1, Math.max(0.01, value));
}

/**
 * @param {File|Blob|ImageBitmap} source
 * @param {{format?: string, quality?: number}} [options]
 * @returns {Promise<{blob: Blob, width: number, height: number}>}
 */
export async function compress(source, options = {}) {
  const { format, quality = DEFAULT_QUALITY } = options || {};
  const bitmap = await decodeImage(source);
  // decodeImage passes ImageBitmap input straight through: only close what we made.
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
    // JPEG has no alpha channel: flatten onto white so transparency is not black.
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
