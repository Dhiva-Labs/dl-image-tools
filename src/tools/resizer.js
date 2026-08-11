/** Resize images by pixel size or percentage, with quality-preserving downscaling. */

import { ImageToolsError, MESSAGES } from '../utils/errors.js';
import {
  decodeImage,
  canvasFrom,
  canvasToBlob,
  isTypeSupported,
  resolveOutputFormat,
  formatLabel,
} from '../utils/image.js';

const DEFAULT_QUALITY = 0.8;

export const PRESETS = Object.freeze([
  { id: 'instagram', label: 'Instagram Post', width: 1080, height: 1080 },
  { id: 'youtube', label: 'YouTube Thumbnail', width: 1280, height: 720 },
  { id: 'twitter', label: 'Twitter/X Post', width: 1600, height: 900 },
  { id: 'facebook', label: 'Facebook Post', width: 1200, height: 630 },
  { id: 'linkedin', label: 'LinkedIn Post', width: 1200, height: 627 },
  { id: 'hd', label: 'HD (1280×720)', width: 1280, height: 720 },
  { id: 'fullhd', label: 'Full HD (1920×1080)', width: 1920, height: 1080 },
  { id: '4k', label: '4K (3840×2160)', width: 3840, height: 2160 },
]);

const isProvided = (value) =>
  value !== undefined && value !== null && !(typeof value === 'string' && value.trim() === '');

function positiveNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    throw new ImageToolsError(MESSAGES.invalidDimensions);
  }
  return num;
}

const toPixels = (value) => Math.max(1, Math.round(value));

function clampQuality(quality) {
  const value = Number(quality);
  if (!Number.isFinite(value)) return DEFAULT_QUALITY;
  return Math.min(1, Math.max(0.01, value));
}

/**
 * Pure dimension maths.
 *
 * @param {{width: number, height: number}} source natural image size
 * @param {{width?: number, height?: number, percent?: number, lockAspect?: boolean}} opts
 *   `percent` (50 = half size) wins over width/height.
 *   `lockAspect` defaults to true: one dimension derives the other, and when
 *   both are given the result is the largest size that fits inside that box.
 * @returns {{width: number, height: number}} integers >= 1
 */
export function computeDimensions(source, opts = {}) {
  const srcWidth = Number(source && source.width);
  const srcHeight = Number(source && source.height);
  if (
    !Number.isFinite(srcWidth) || srcWidth <= 0 ||
    !Number.isFinite(srcHeight) || srcHeight <= 0
  ) {
    throw new ImageToolsError(MESSAGES.invalidDimensions);
  }

  const options = opts || {};
  const lockAspect = options.lockAspect === undefined ? true : Boolean(options.lockAspect);
  const hasPercent = isProvided(options.percent);
  const hasWidth = isProvided(options.width);
  const hasHeight = isProvided(options.height);

  if (!hasPercent && !hasWidth && !hasHeight) {
    throw new ImageToolsError(MESSAGES.noDimensions);
  }

  if (hasPercent) {
    const scale = positiveNumber(options.percent) / 100;
    return {
      width: toPixels(srcWidth * scale),
      height: toPixels(srcHeight * scale),
    };
  }

  const width = hasWidth ? positiveNumber(options.width) : null;
  const height = hasHeight ? positiveNumber(options.height) : null;

  if (width !== null && height !== null) {
    if (!lockAspect) {
      return { width: toPixels(width), height: toPixels(height) };
    }
    const scale = Math.min(width / srcWidth, height / srcHeight);
    return {
      width: toPixels(srcWidth * scale),
      height: toPixels(srcHeight * scale),
    };
  }

  if (width !== null) {
    return {
      width: toPixels(width),
      height: lockAspect ? toPixels(srcHeight * (width / srcWidth)) : toPixels(srcHeight),
    };
  }

  return {
    width: lockAspect ? toPixels(srcWidth * (height / srcHeight)) : toPixels(srcWidth),
    height: toPixels(height),
  };
}

/**
 * Draw the bitmap at the target size. Reductions larger than 2x are done with
 * a high-quality bitmap resize, falling back to stepped halving, so downscales
 * do not alias.
 */
async function renderScaled(bitmap, width, height, background) {
  const ratio = Math.max(bitmap.width / width, bitmap.height / height);

  if (ratio <= 2) {
    return canvasFrom(bitmap, width, height, { background });
  }

  if (typeof createImageBitmap === 'function') {
    let resized = null;
    try {
      resized = await createImageBitmap(bitmap, {
        resizeWidth: width,
        resizeHeight: height,
        resizeQuality: 'high',
      });
    } catch {
      resized = null;
    }
    if (resized) {
      try {
        return canvasFrom(resized, width, height, { background });
      } finally {
        if (typeof resized.close === 'function') resized.close();
      }
    }
  }

  // Stepped halving: each pass averages 4 source pixels into 1.
  let current = bitmap;
  let currentWidth = bitmap.width;
  let currentHeight = bitmap.height;
  while (currentWidth > width * 2 || currentHeight > height * 2) {
    const nextWidth = Math.max(width, Math.round(currentWidth / 2));
    const nextHeight = Math.max(height, Math.round(currentHeight / 2));
    if (nextWidth === currentWidth && nextHeight === currentHeight) break;
    current = canvasFrom(current, nextWidth, nextHeight);
    currentWidth = nextWidth;
    currentHeight = nextHeight;
  }
  return canvasFrom(current, width, height, { background });
}

/**
 * @param {File|Blob|ImageBitmap} source
 * @param {{width?, height?, percent?, lockAspect?, format?, quality?}} opts
 * @returns {Promise<{blob: Blob, width: number, height: number}>}
 */
export async function resize(source, opts = {}) {
  const options = opts || {};
  const bitmap = await decodeImage(source);
  const owned = bitmap !== source;

  try {
    const target = computeDimensions(
      { width: bitmap.width, height: bitmap.height },
      options
    );
    const format = await resolveOutputFormat(source, options.format);
    if (!(await isTypeSupported(format))) {
      throw new ImageToolsError(
        `Your browser cannot create ${formatLabel(format)} images. Try a different output format.`
      );
    }

    const background = format === 'image/jpeg' ? '#ffffff' : null;
    const canvas = await renderScaled(bitmap, target.width, target.height, background);
    const blob = await canvasToBlob(
      canvas,
      format,
      format === 'image/png' ? undefined : clampQuality(options.quality)
    );

    return { blob, width: target.width, height: target.height };
  } finally {
    if (owned && typeof bitmap.close === 'function') bitmap.close();
  }
}
