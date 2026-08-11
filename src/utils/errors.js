/**
 * Error types and friendly-message mapping for DL Image Tools.
 *
 * Rules:
 * - Every error surfaced to the UI carries a short, plain-English sentence.
 * - Stack traces and raw DOMException text never reach the user.
 */

const PROCESS_FAILED =
  'Unable to process this image. The image may be corrupted or too large. ' +
  'Try another image or reduce its dimensions first.';

export const MESSAGES = Object.freeze({
  /** Generic fallback, also used for out-of-memory / oversized canvases. */
  process: PROCESS_FAILED,
  tooLarge: PROCESS_FAILED,
  decode:
    'Unable to read this image. The file may be corrupted or in a format your ' +
    'browser cannot open. Try another image.',
  noSource: 'No image was provided. Choose an image and try again.',
  encodeFailed:
    'Unable to save this image. Try a different output format or a smaller image.',
  encodeUnsupported:
    'Your browser cannot save images in that format. Try a different output format.',
  noDimensions:
    'Enter a width, a height, or a percentage to resize this image.',
  invalidDimensions: 'Width and height must be numbers greater than zero.',
  base64:
    'That does not look like valid image data. Paste a complete base64 string ' +
    'or data URI and try again.',
  crossOrigin:
    'This image could not be loaded from its website. Try downloading it first, ' +
    'then open it here.',
  cancelled: 'The operation was cancelled.',
  unsupportedBrowser:
    'Your browser does not support the image features this tool needs.',
  unknownOperation: 'That action is not available.',
});

/** Base class: every instance exposes a user-safe `.userMessage`. */
export class ImageToolsError extends Error {
  constructor(message = PROCESS_FAILED, options = {}) {
    super(message, options && options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'ImageToolsError';
    this.userMessage =
      (options && typeof options.userMessage === 'string' && options.userMessage) ||
      message ||
      PROCESS_FAILED;
  }
}

/** Raised when an image cannot be decoded into an ImageBitmap. */
export class DecodeError extends ImageToolsError {
  constructor(message = MESSAGES.decode, options = {}) {
    super(message, options);
    this.name = 'DecodeError';
  }
}

/** Raised when base64 / data-URI input is malformed or not an image. */
export class Base64Error extends ImageToolsError {
  constructor(message = MESSAGES.base64, options = {}) {
    super(message, options);
    this.name = 'Base64Error';
  }
}

const looksLikeStack = (text) => /\n\s*at\s/.test(text) || /^[A-Za-z]*Error:/.test(text);

/**
 * Convert anything throwable into a friendly sentence.
 * Never returns a stack trace, and never returns an empty string.
 */
export function toUserMessage(err) {
  if (err === null || err === undefined) return MESSAGES.process;

  if (typeof err === 'string') {
    const text = err.trim();
    if (!text || looksLikeStack(text)) return MESSAGES.process;
    return text;
  }

  if (typeof err !== 'object') return MESSAGES.process;

  if (err instanceof ImageToolsError) {
    return err.userMessage || MESSAGES.process;
  }

  // Errors that crossed a worker/realm boundary lose their prototype but keep data.
  if (typeof err.userMessage === 'string' && err.userMessage.trim()) {
    return err.userMessage.trim();
  }

  const name = typeof err.name === 'string' ? err.name : '';
  const text = typeof err.message === 'string' ? err.message : '';

  if (name === 'AbortError') return MESSAGES.cancelled;
  if (name === 'SecurityError') return MESSAGES.crossOrigin;
  if (name === 'NotSupportedError' || name === 'EncodingError') {
    return MESSAGES.encodeUnsupported;
  }
  if (
    name === 'QuotaExceededError' ||
    name === 'RangeError' ||
    /out of memory|allocation failed|too large|maximum size|invalid array length/i.test(text)
  ) {
    return MESSAGES.tooLarge;
  }

  return MESSAGES.process;
}
