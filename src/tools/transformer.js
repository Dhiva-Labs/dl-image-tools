import { decodeImage, canvasToBlob, isTypeSupported, MIME_TO_EXT } from '../utils/image.js';
import { ImageToolsError } from '../utils/errors.js';

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

export async function rotate(source, degrees, { format, quality } = {}) {
  if (degrees !== 90 && degrees !== 180 && degrees !== 270) {
    throw new ImageToolsError('Rotation must be 90, 180, or 270 degrees.');
  }

  const bitmap = await decodeImage(source);
  try {
    const swap = degrees === 90 || degrees === 270;
    const width = swap ? bitmap.height : bitmap.width;
    const height = swap ? bitmap.width : bitmap.height;

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.translate(width / 2, height / 2);
    ctx.rotate((degrees * Math.PI) / 180);
    ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);

    const outFormat = await resolveFormat(source, format);
    const outQuality = quality == null ? 0.8 : quality;
    const blob = await canvasToBlob(canvas, outFormat, outQuality);

    return { blob, width, height };
  } finally {
    if (bitmap !== source) bitmap.close();
  }
}

export async function flip(source, axis, { format, quality } = {}) {
  if (axis !== 'horizontal' && axis !== 'vertical') {
    throw new ImageToolsError('Flip axis must be "horizontal" or "vertical".');
  }

  const bitmap = await decodeImage(source);
  try {
    const width = bitmap.width;
    const height = bitmap.height;

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (axis === 'horizontal') {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    } else {
      ctx.translate(0, height);
      ctx.scale(1, -1);
    }
    ctx.drawImage(bitmap, 0, 0);

    const outFormat = await resolveFormat(source, format);
    const outQuality = quality == null ? 0.8 : quality;
    const blob = await canvasToBlob(canvas, outFormat, outQuality);

    return { blob, width, height };
  } finally {
    if (bitmap !== source) bitmap.close();
  }
}
