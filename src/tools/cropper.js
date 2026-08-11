import { decodeImage, canvasToBlob, isTypeSupported, MIME_TO_EXT } from '../utils/image.js';
import { ImageToolsError } from '../utils/errors.js';

export const ASPECT_RATIOS = [
  { id: 'free', label: 'Free', ratio: null },
  { id: 'square', label: '1:1', ratio: 1 },
  { id: '16-9', label: '16:9', ratio: 16 / 9 },
  { id: '4-3', label: '4:3', ratio: 4 / 3 },
  { id: '3-2', label: '3:2', ratio: 3 / 2 },
  { id: '9-16', label: '9:16', ratio: 9 / 16 },
];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

async function resolveFormat(source, requestedFormat) {
  if (requestedFormat) return requestedFormat;
  const inputType = source && typeof source.type === 'string' ? source.type : '';
  if (inputType === 'image/avif') {
    const avifOk = await isTypeSupported('image/avif');
    return avifOk ? 'image/avif' : 'image/webp';
  }
  if (Object.prototype.hasOwnProperty.call(MIME_TO_EXT, inputType)) {
    return inputType;
  }
  return 'image/png';
}

export async function crop(source, rect, { format, quality } = {}) {
  const bitmap = await decodeImage(source);
  try {
    const maxWidth = bitmap.width;
    const maxHeight = bitmap.height;

    const x = clamp(Math.round(rect.x), 0, maxWidth);
    const y = clamp(Math.round(rect.y), 0, maxHeight);
    const width = Math.round(clamp(rect.width, 0, maxWidth - x));
    const height = Math.round(clamp(rect.height, 0, maxHeight - y));

    if (width < 1 || height < 1) {
      throw new ImageToolsError('The crop area is too small. Please select a larger region.');
    }

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, x, y, width, height, 0, 0, width, height);

    const outFormat = await resolveFormat(source, format);
    const outQuality = quality == null ? 0.8 : quality;
    const blob = await canvasToBlob(canvas, outFormat, outQuality);

    return { blob, width, height };
  } finally {
    if (bitmap !== source) bitmap.close();
  }
}
