import { formatBytes } from '../utils/image.js';
import { Base64Error } from '../utils/errors.js';

const DATA_URI_RE = /^data:([a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+)?(?:;charset=[^;,]+)?(;base64)?,(.*)$/s;
const BASE64_ALPHABET_RE = /^[A-Za-z0-9+/]*={0,2}$/;
const CHUNK_CHARS = 1 << 16; // must stay a multiple of 4

export async function toBase64(file) {
  const dataUri = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Base64Error('Could not read the file. Please try again.'));
    reader.readAsDataURL(file);
  });

  const commaIndex = dataUri.indexOf(',');
  const base64 = commaIndex >= 0 ? dataUri.slice(commaIndex + 1) : dataUri;

  return {
    base64,
    dataUri,
    sizeLabel: formatBytes(base64.length),
    charCount: base64.length,
  };
}

function parseInput(raw) {
  const trimmed = raw.replace(/\s+/g, '');
  const match = DATA_URI_RE.exec(trimmed);
  if (match) {
    const [, declaredMime, isBase64Flag, payload] = match;
    if (!isBase64Flag) {
      throw new Base64Error('Only base64-encoded data URIs are supported.');
    }
    return { declaredMime: declaredMime || null, base64: payload };
  }
  return { declaredMime: null, base64: trimmed };
}

function validateBase64(base64) {
  if (!base64 || base64.length === 0) {
    throw new Base64Error('No Base64 data was provided.');
  }
  if (base64.length % 4 !== 0 || !BASE64_ALPHABET_RE.test(base64)) {
    throw new Base64Error("That doesn't look like valid Base64 data.");
  }
}

function paddingCount(base64) {
  if (base64.endsWith('==')) return 2;
  if (base64.endsWith('=')) return 1;
  return 0;
}

function base64ToBytes(base64) {
  const totalLength = Math.floor((base64.length / 4) * 3) - paddingCount(base64);
  const bytes = new Uint8Array(Math.max(totalLength, 0));
  let offset = 0;

  for (let i = 0; i < base64.length; i += CHUNK_CHARS) {
    const chunk = base64.slice(i, i + CHUNK_CHARS);
    let binary;
    try {
      binary = atob(chunk);
    } catch (err) {
      throw new Base64Error("That doesn't look like valid Base64 data.");
    }
    for (let j = 0; j < binary.length; j++) {
      bytes[offset + j] = binary.charCodeAt(j);
    }
    offset += binary.length;
  }

  return bytes.subarray(0, offset);
}

export function detectMime(bytes) {
  if (!bytes || bytes.length < 4) return null;

  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png';
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return 'image/gif';
  }
  return null;
}

export async function fromBase64(input) {
  if (typeof input !== 'string') {
    throw new Base64Error('Please provide Base64 text or a data URI.');
  }

  const { base64 } = parseInput(input);
  validateBase64(base64);
  const bytes = base64ToBytes(base64);

  // Magic-number detection always wins over a declared data URI mime type;
  // a declared mime is only ever a hint and is ignored if it disagrees.
  const mime = detectMime(bytes);
  if (!mime) {
    throw new Base64Error("This doesn't look like a supported image (PNG, JPEG, WebP, or GIF).");
  }

  const blob = new Blob([bytes], { type: mime });

  let bitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch (err) {
    throw new Base64Error('The image data is corrupted and could not be decoded.');
  }
  const width = bitmap.width;
  const height = bitmap.height;
  bitmap.close();

  const objectUrl = URL.createObjectURL(blob);

  return { blob, mime, width, height, objectUrl };
}
