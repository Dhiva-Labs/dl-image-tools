import { formatBytes } from '../utils/image.js';

const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // 'Exif\0\0'
const APP1_SCAN_LIMIT = 128 * 1024;

function gcd(a, b) {
  let x = a;
  let y = b;
  while (y) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x;
}

function computeAspectRatio(width, height) {
  if (!width || !height) return '0:0';
  const divisor = gcd(width, height) || 1;
  const w = width / divisor;
  const h = height / divisor;
  if (w <= 32 && h <= 32) {
    return `${w}:${h}`;
  }
  return `${(width / height).toFixed(2)}:1`;
}

function matchesExifHeader(bytes, start) {
  if (start + EXIF_HEADER.length > bytes.length) return false;
  for (let k = 0; k < EXIF_HEADER.length; k++) {
    if (bytes[start + k] !== EXIF_HEADER[k]) return false;
  }
  return true;
}

async function scanForExif(file) {
  if (!file || file.type !== 'image/jpeg') return false;

  const scanLength = Math.min(file.size, APP1_SCAN_LIMIT);
  const buffer = await file.slice(0, scanLength).arrayBuffer();
  const bytes = new Uint8Array(buffer);

  for (let i = 0; i < bytes.length - 1; i++) {
    if (bytes[i] === 0xff && bytes[i + 1] === 0xe1) {
      // APP1 segment: marker(2) + length(2) + payload
      const payloadStart = i + 4;
      if (matchesExifHeader(bytes, payloadStart)) {
        return true;
      }
    }
  }
  return false;
}

export async function getMetadata(file) {
  const bitmap = await createImageBitmap(file);
  const width = bitmap.width;
  const height = bitmap.height;
  bitmap.close();

  const sizeBytes = file.size;
  const hasExif = await scanForExif(file);
  const lastModified =
    typeof file.lastModified === 'number' && !Number.isNaN(file.lastModified)
      ? new Date(file.lastModified)
      : null;

  return {
    name: file.name,
    type: file.type,
    sizeBytes,
    sizeLabel: formatBytes(sizeBytes),
    width,
    height,
    aspectRatio: computeAspectRatio(width, height),
    lastModified,
    hasExif,
    megapixels: Math.round(((width * height) / 1e6) * 10) / 10,
  };
}
