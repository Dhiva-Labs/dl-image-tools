/**
 * Module Web Worker: runs the heavy image work off the UI thread.
 *
 * Protocol
 *   in : { id, op, args: { source, ...opts } }
 *   out: { id, ok: true, result } | { id, ok: false, error: { message } }
 *
 * Blobs and ImageBitmaps survive structured clone, so nothing here needs a
 * manual transfer list.
 */

import { compress } from '../tools/compressor.js';
import { convert } from '../tools/converter.js';
import { resize } from '../tools/resizer.js';
import { crop } from '../tools/cropper.js';
import { rotate, flip } from '../tools/transformer.js';
import { ImageToolsError, MESSAGES, toUserMessage } from './errors.js';

/**
 * Callers may send either `{ source, ...opts }` or `{ source, opts: {...} }`.
 * Both are accepted so panels can use whichever reads better.
 */
function normalizeArgs(args) {
  const raw = args && typeof args === 'object' ? args : {};
  if (!raw.opts || typeof raw.opts !== 'object') return raw;
  const { opts, ...rest } = raw;
  return { ...rest, ...opts };
}

const HANDLERS = {
  compress: (args) =>
    compress(args.source, { format: args.format, quality: args.quality }),
  resize: (args) => {
    const { source, ...opts } = args;
    return resize(source, opts);
  },
  convert: (args) => convert(args.source, args.format, args.quality),
  crop: (args) =>
    crop(args.source, args.rect, { format: args.format, quality: args.quality }),
  rotate: (args) =>
    rotate(args.source, args.degrees, { format: args.format, quality: args.quality }),
  flip: (args) =>
    flip(args.source, args.axis, { format: args.format, quality: args.quality }),
};

self.onmessage = async (event) => {
  const data = (event && event.data) || {};
  const { id, op } = data;
  const args = normalizeArgs(data.args);

  try {
    const handler = HANDLERS[op];
    if (!handler) throw new ImageToolsError(MESSAGES.unknownOperation);
    const result = await handler(args);
    self.postMessage({ id, ok: true, result });
  } catch (err) {
    self.postMessage({ id, ok: false, error: { message: toUserMessage(err) } });
  }
};

self.onmessageerror = (event) => {
  const id = event && event.data && event.data.id;
  self.postMessage({ id, ok: false, error: { message: MESSAGES.process } });
};
