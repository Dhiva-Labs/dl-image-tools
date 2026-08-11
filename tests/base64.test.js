import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectMime, fromBase64 } from '../src/tools/base64.js';
import { Base64Error } from '../src/utils/errors.js';

// detectMime --------------------------------------------------------------

test('detectMime: recognizes PNG magic number', () => {
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  assert.equal(detectMime(bytes), 'image/png');
});

test('detectMime: recognizes JPEG magic number', () => {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
  assert.equal(detectMime(bytes), 'image/jpeg');
});

test('detectMime: recognizes WEBP magic number (RIFF....WEBP)', () => {
  // 'RIFF' + 4-byte size + 'WEBP'
  const bytes = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, // RIFF
    0x00, 0x00, 0x00, 0x00, // size (irrelevant for detection)
    0x57, 0x45, 0x42, 0x50, // WEBP
  ]);
  assert.equal(detectMime(bytes), 'image/webp');
});

test('detectMime: recognizes GIF magic number', () => {
  const bytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0]);
  assert.equal(detectMime(bytes), 'image/gif');
});

test('detectMime: returns null for unrecognized bytes', () => {
  const bytes = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]);
  assert.equal(detectMime(bytes), null);
});

test('detectMime: returns null for empty/too-short input', () => {
  assert.equal(detectMime(new Uint8Array([])), null);
});

// fromBase64 ----------------------------------------------------------------
// Node has no createImageBitmap, so we can only exercise the pre-decode
// validation path: clearly invalid base64/data-URI input must be rejected
// before the function ever tries to touch a browser-only API.

test('fromBase64: rejects input that is not valid base64', async () => {
  await assert.rejects(() => fromBase64('not base64!!!'));
});

test('fromBase64: rejects empty input', async () => {
  await assert.rejects(() => fromBase64(''));
});

// Base64Error sanity ----------------------------------------------------------

test('Base64Error: is a constructible Error subclass with a friendly message', () => {
  const err = new Base64Error('bad input');
  assert.ok(err instanceof Error);
  assert.equal(err.message, 'bad input');
});
