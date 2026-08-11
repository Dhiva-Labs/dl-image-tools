/**
 * Front door for heavy image work.
 *
 * Sends jobs to a lazily created module worker and, whenever workers or
 * OffscreenCanvas are unavailable (or the worker fails to boot), transparently
 * re-runs the same job on the calling thread. Callers only ever see either a
 * result or an Error carrying a friendly message.
 */

import { MESSAGES, toUserMessage } from './errors.js';

const LOADERS = {
  compress: () => import('../tools/compressor.js'),
  resize: () => import('../tools/resizer.js'),
  convert: () => import('../tools/converter.js'),
  crop: () => import('../tools/cropper.js'),
  rotate: () => import('../tools/transformer.js'),
  flip: () => import('../tools/transformer.js'),
};

let worker = null;
let workerDisabled = false;
let nextId = 1;
const pending = new Map();

function workerSupported() {
  return (
    !workerDisabled &&
    typeof Worker === 'function' &&
    typeof OffscreenCanvas === 'function' &&
    typeof URL === 'function'
  );
}

function handleMessage(event) {
  const data = (event && event.data) || {};
  const entry = pending.get(data.id);
  if (!entry) return;
  pending.delete(data.id);
  if (data.ok) {
    entry.resolve(data.result);
  } else {
    const message = (data.error && data.error.message) || MESSAGES.process;
    entry.reject(new Error(message));
  }
}

/**
 * The worker died (bad boot, import failure, crash). Disable it for the rest of
 * the session and replay everything that was in flight on this thread.
 */
function handleFailure(event) {
  if (event && typeof event.preventDefault === 'function') event.preventDefault();
  workerDisabled = true;

  const inFlight = Array.from(pending.values());
  pending.clear();
  if (worker) {
    worker.terminate();
    worker = null;
  }

  for (const entry of inFlight) {
    runOnThisThread(entry.op, entry.args).then(entry.resolve, entry.reject);
  }
}

function getWorker() {
  if (worker) return worker;
  const created = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  created.onmessage = handleMessage;
  created.onerror = handleFailure;
  created.onmessageerror = handleFailure;
  worker = created;
  return created;
}

/**
 * Callers may send either `{ source, ...opts }` or `{ source, opts: {...} }`.
 * worker.js accepts both as well, so the two paths stay identical.
 */
function normalizeArgs(args) {
  const raw = args && typeof args === 'object' ? args : {};
  if (!raw.opts || typeof raw.opts !== 'object') return raw;
  const { opts, ...rest } = raw;
  return { ...rest, ...opts };
}

function callTool(module, op, args) {
  switch (op) {
    case 'compress':
      return module.compress(args.source, { format: args.format, quality: args.quality });
    case 'resize': {
      const { source, ...opts } = args;
      return module.resize(source, opts);
    }
    case 'convert':
      return module.convert(args.source, args.format, args.quality);
    case 'crop':
      return module.crop(args.source, args.rect, {
        format: args.format,
        quality: args.quality,
      });
    case 'rotate':
      return module.rotate(args.source, args.degrees, {
        format: args.format,
        quality: args.quality,
      });
    case 'flip':
      return module.flip(args.source, args.axis, {
        format: args.format,
        quality: args.quality,
      });
    default:
      return Promise.reject(new Error(MESSAGES.unknownOperation));
  }
}

async function runOnThisThread(op, args) {
  const load = LOADERS[op];
  if (!load) throw new Error(MESSAGES.unknownOperation);
  try {
    const module = await load();
    return await callTool(module, op, normalizeArgs(args));
  } catch (err) {
    const friendly = new Error(toUserMessage(err));
    friendly.cause = err;
    throw friendly;
  }
}

function postToWorker(op, args, transfer) {
  return new Promise((resolve, reject) => {
    let active;
    try {
      active = getWorker();
    } catch (err) {
      reject({ __unavailable: true, cause: err });
      return;
    }

    const id = nextId++;
    pending.set(id, { resolve, reject, op, args });
    try {
      active.postMessage({ id, op, args }, transfer);
    } catch (err) {
      pending.delete(id);
      reject({ __unavailable: true, cause: err });
    }
  });
}

/**
 * @param {'compress'|'resize'|'convert'|'crop'|'rotate'|'flip'} op
 * @param {object} args { source, ...opts }
 * @param {Transferable[]} [transfer]
 * @returns {Promise<{blob: Blob, width: number, height: number}>}
 */
export async function runInWorker(op, args = {}, transfer = []) {
  if (workerSupported()) {
    try {
      return await postToWorker(op, args, transfer);
    } catch (err) {
      if (!err || err.__unavailable !== true) throw err;
      workerDisabled = true;
    }
  }
  return runOnThisThread(op, args);
}

/** Stop the worker and reject anything still in flight. Safe to call twice. */
export function terminateWorker() {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  for (const entry of pending.values()) {
    entry.reject(new Error(MESSAGES.cancelled));
  }
  pending.clear();
}
