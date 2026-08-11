/**
 * Canvas / bitmap primitives shared by every tool.
 * Works in a window, an extension tab and a module Web Worker:
 * `document` is only touched inside the explicit OffscreenCanvas fallback.
 */

import { ImageToolsError, DecodeError, MESSAGES } from './errors.js';

export const MIME_TO_EXT = Object.freeze({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
});

export const ACCEPTED_TYPES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/bmp',
]);

/** Types a canvas may be asked to encode to (GIF/BMP are read-only). */
export const ENCODABLE_TYPES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
]);

const FORMAT_LABELS = Object.freeze({
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
  'image/avif': 'AVIF',
  'image/gif': 'GIF',
  'image/bmp': 'BMP',
});

/** 'image/webp' -> 'WebP'; unknown types degrade to their subtype in caps. */
export function formatLabel(type) {
  if (typeof type !== 'string' || !type) return 'this format';
  if (FORMAT_LABELS[type]) return FORMAT_LABELS[type];
  const sub = type.includes('/') ? type.split('/')[1] : type;
  return sub.toUpperCase();
}

const isBlobLike = (value) =>
  typeof Blob !== 'undefined' && value instanceof Blob;

const isBitmap = (value) =>
  typeof ImageBitmap !== 'undefined' && value instanceof ImageBitmap;

/**
 * Decode a File/Blob into an ImageBitmap. An ImageBitmap passes straight
 * through, so callers can detect ownership with `bitmap !== source` and only
 * close what they created.
 */
export async function decodeImage(source) {
  if (!source) throw new DecodeError(MESSAGES.noSource);
  if (isBitmap(source)) return source;
  if (!isBlobLike(source)) throw new DecodeError(MESSAGES.noSource);
  if (source.size === 0) throw new DecodeError(MESSAGES.decode);
  if (typeof createImageBitmap !== 'function') {
    throw new DecodeError(MESSAGES.unsupportedBrowser);
  }

  let bitmap;
  try {
    bitmap = await createImageBitmap(source);
  } catch (err) {
    throw new DecodeError(MESSAGES.decode, { cause: err });
  }
  if (!bitmap || !bitmap.width || !bitmap.height) {
    throw new DecodeError(MESSAGES.decode);
  }
  return bitmap;
}

function createCanvas(width, height) {
  if (typeof OffscreenCanvas === 'function') {
    return new OffscreenCanvas(width, height);
  }
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  throw new ImageToolsError(MESSAGES.unsupportedBrowser);
}

/**
 * Draw `bitmap` (or any CanvasImageSource) scaled into a new canvas.
 * `options.background` fills the canvas first — used when flattening
 * transparency for formats without an alpha channel.
 */
export function canvasFrom(bitmap, w = bitmap.width, h = bitmap.height, options = {}) {
  if (!bitmap) throw new ImageToolsError(MESSAGES.noSource);

  const width = Math.max(1, Math.round(Number(w) || 0) || 1);
  const height = Math.max(1, Math.round(Number(h) || 0) || 1);
  const background = options && options.background ? options.background : null;

  let canvas;
  try {
    canvas = createCanvas(width, height);
  } catch (err) {
    if (err instanceof ImageToolsError) throw err;
    throw new ImageToolsError(MESSAGES.tooLarge, { cause: err });
  }

  let ctx;
  try {
    ctx = canvas.getContext('2d', { alpha: !background });
  } catch (err) {
    throw new ImageToolsError(MESSAGES.tooLarge, { cause: err });
  }
  if (!ctx) throw new ImageToolsError(MESSAGES.tooLarge);

  try {
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, width, height);
  } catch (err) {
    throw new ImageToolsError(MESSAGES.tooLarge, { cause: err });
  }

  return canvas;
}

/** Encode a canvas. Rejects with ImageToolsError when the encoder bails out. */
export async function canvasToBlob(canvas, type = 'image/png', quality) {
  if (!canvas) throw new ImageToolsError(MESSAGES.encodeFailed);

  const mime = typeof type === 'string' && type ? type : 'image/png';
  const useQuality =
    mime !== 'image/png' && typeof quality === 'number' && Number.isFinite(quality);

  let blob = null;
  if (typeof canvas.convertToBlob === 'function') {
    const opts = useQuality ? { type: mime, quality } : { type: mime };
    try {
      blob = await canvas.convertToBlob(opts);
    } catch (err) {
      throw new ImageToolsError(encodeMessage(mime, err), { cause: err });
    }
  } else if (typeof canvas.toBlob === 'function') {
    blob = await new Promise((resolve, reject) => {
      try {
        if (useQuality) canvas.toBlob(resolve, mime, quality);
        else canvas.toBlob(resolve, mime);
      } catch (err) {
        reject(new ImageToolsError(encodeMessage(mime, err), { cause: err }));
      }
    });
  } else {
    throw new ImageToolsError(MESSAGES.unsupportedBrowser);
  }

  if (!blob || typeof blob.size !== 'number' || blob.size === 0) {
    throw new ImageToolsError(encodeMessage(mime));
  }
  // Browsers silently fall back to PNG for formats they cannot encode.
  if (blob.type && blob.type !== mime) {
    throw new ImageToolsError(unsupportedMessage(mime));
  }
  return blob;
}

function encodeMessage(mime, cause) {
  // Encoders run out of memory on huge canvases: that is a size problem, not a
  // format problem, so say so.
  const name = cause && typeof cause.name === 'string' ? cause.name : '';
  const text = cause && typeof cause.message === 'string' ? cause.message : '';
  if (name === 'RangeError' || name === 'QuotaExceededError' || /memory|too large/i.test(text)) {
    return MESSAGES.tooLarge;
  }
  return `Unable to save this image as ${formatLabel(mime)}. Try a different output format.`;
}

function unsupportedMessage(mime) {
  return `Your browser cannot create ${formatLabel(mime)} images. Try a different output format.`;
}

const supportCache = new Map();

/** Encode-support probe on a 1x1 canvas. Memoized per MIME type. */
export async function isTypeSupported(type) {
  if (typeof type !== 'string' || !type) return false;
  if (supportCache.has(type)) return supportCache.get(type);

  const probe = (async () => {
    try {
      const canvas = createCanvas(1, 1);
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      ctx.clearRect(0, 0, 1, 1);
      let blob = null;
      if (typeof canvas.convertToBlob === 'function') {
        blob = await canvas.convertToBlob({ type, quality: 0.5 });
      } else if (typeof canvas.toBlob === 'function') {
        blob = await new Promise((resolve) => canvas.toBlob(resolve, type, 0.5));
      }
      return Boolean(blob && blob.size > 0 && blob.type === type);
    } catch {
      return false;
    }
  })();

  supportCache.set(type, probe);
  const supported = await probe;
  supportCache.set(type, supported);
  return supported;
}

/**
 * Pick the output MIME type when the caller did not ask for one:
 * same as the input, except AVIF-in -> WebP-out when AVIF encoding is missing,
 * and read-only inputs (GIF/BMP) -> PNG.
 * An explicitly requested format is returned untouched so callers can reject it.
 */
export async function resolveOutputFormat(source, requested) {
  if (typeof requested === 'string' && requested) return requested;

  const sourceType = source && typeof source.type === 'string' ? source.type : '';
  let candidate = ENCODABLE_TYPES.includes(sourceType) ? sourceType : 'image/png';
  if (candidate === 'image/avif' && !(await isTypeSupported('image/avif'))) {
    candidate = 'image/webp';
    if (!(await isTypeSupported('image/webp'))) candidate = 'image/png';
  }
  return candidate;
}

const SIZE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

/** 2411724 -> '2.3 MB'. Bytes are whole numbers, larger units get one decimal. */
export function formatBytes(n) {
  const bytes = Number(n);
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';

  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < SIZE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  if (unit === 0) return `${Math.round(value)} B`;

  // Guard the 1023.97 KB -> '1024.0 KB' rounding edge.
  if (Number(value.toFixed(1)) >= 1024 && unit < SIZE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${SIZE_UNITS[unit]}`;
}

/** ('photo.jpg', '-compressed', 'webp') -> 'photo-compressed.webp'. */
export function outputFilename(inputName, suffix = '', ext = '') {
  const raw = typeof inputName === 'string' ? inputName : '';
  const base = raw.split(/[\\/]/).pop().trim();
  const dot = base.lastIndexOf('.');
  const stemRaw = dot > 0 ? base.slice(0, dot) : base;
  const stem = stemRaw.replace(/[\u0000-\u001f<>:"|?*]/g, '').trim() || 'image';

  let extension = typeof ext === 'string' ? ext.trim() : '';
  if (extension.includes('/')) extension = MIME_TO_EXT[extension] || extension.split('/')[1];
  extension = extension.replace(/^\.+/, '').toLowerCase();

  const suf = typeof suffix === 'string' ? suffix : '';
  return extension ? `${stem}${suf}.${extension}` : `${stem}${suf}`;
}
