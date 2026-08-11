import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatBytes, outputFilename, MIME_TO_EXT } from '../src/utils/image.js';

// formatBytes -----------------------------------------------------------

test('formatBytes: sub-KB values are reported in bytes', () => {
  const out = formatBytes(500);
  assert.match(out, /^500(\.0+)? ?B$/i);
});

test('formatBytes: zero bytes', () => {
  const out = formatBytes(0);
  assert.match(out, /^0(\.0+)? ?B$/i);
});

test('formatBytes: KB boundary just above 1024', () => {
  const out = formatBytes(1536); // 1.5 KB
  assert.match(out, /KB/i);
  const num = parseFloat(out);
  assert.ok(Math.abs(num - 1.5) < 0.05, `expected ~1.5, got ${num} (${out})`);
});

test('formatBytes: value just under the KB boundary stays in bytes', () => {
  const out = formatBytes(1023);
  assert.match(out, /B$/i);
  assert.doesNotMatch(out, /KB|MB|GB/i);
});

test('formatBytes: MB boundary', () => {
  const out = formatBytes(2.4 * 1024 * 1024);
  assert.match(out, /MB/i);
  const num = parseFloat(out);
  assert.ok(Math.abs(num - 2.4) < 0.05, `expected ~2.4, got ${num} (${out})`);
});

test('formatBytes: value just under the MB boundary stays in KB', () => {
  const out = formatBytes(1024 * 1023);
  assert.match(out, /KB/i);
  assert.doesNotMatch(out, /MB/i);
});

// outputFilename ----------------------------------------------------------

test('outputFilename: replaces extension and inserts suffix', () => {
  assert.equal(outputFilename('photo.jpg', '-compressed', 'webp'), 'photo-compressed.webp');
});

test('outputFilename: handles filenames with multiple dots (keeps all but the last segment)', () => {
  assert.equal(outputFilename('my.photo.name.png', '-resized', 'jpg'), 'my.photo.name-resized.jpg');
});

test('outputFilename: handles filenames with no extension', () => {
  assert.equal(outputFilename('photo', '-edited', 'png'), 'photo-edited.png');
});

test('outputFilename: handles empty suffix', () => {
  assert.equal(outputFilename('photo.jpg', '', 'png'), 'photo.png');
});

// MIME_TO_EXT ---------------------------------------------------------------

test('MIME_TO_EXT: covers every format named in the contract', () => {
  assert.equal(MIME_TO_EXT['image/jpeg'], 'jpg');
  assert.equal(MIME_TO_EXT['image/png'], 'png');
  assert.equal(MIME_TO_EXT['image/webp'], 'webp');
  assert.equal(MIME_TO_EXT['image/avif'], 'avif');
});
