import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeDimensions, PRESETS } from '../src/tools/resizer.js';

test('computeDimensions: width-only + lockAspect derives height', () => {
  const dims = computeDimensions({ width: 1200, height: 800 }, { width: 600, lockAspect: true });
  assert.equal(dims.width, 600);
  assert.equal(dims.height, 400);
});

test('computeDimensions: height-only + lockAspect derives width', () => {
  const dims = computeDimensions({ width: 1200, height: 800 }, { height: 400, lockAspect: true });
  assert.equal(dims.width, 600);
  assert.equal(dims.height, 400);
});

test('computeDimensions: both dimensions given, unlocked -> used as-is', () => {
  const dims = computeDimensions({ width: 1200, height: 800 }, { width: 500, height: 250, lockAspect: false });
  assert.equal(dims.width, 500);
  assert.equal(dims.height, 250);
});

test('computeDimensions: percent overrides width/height', () => {
  const dims = computeDimensions({ width: 800, height: 400 }, { width: 999, height: 999, percent: 50, lockAspect: false });
  assert.equal(dims.width, 400);
  assert.equal(dims.height, 200);
});

test('computeDimensions: results are rounded to the nearest sane integer', () => {
  const original = { width: 333, height: 111 };
  const dims = computeDimensions(original, { width: 100, lockAspect: true });
  const exact = (100 * original.height) / original.width; // 33.33...
  assert.ok(Number.isInteger(dims.width));
  assert.ok(Number.isInteger(dims.height));
  assert.ok(Math.abs(dims.height - exact) < 1, `expected height near ${exact}, got ${dims.height}`);
});

test('computeDimensions: output is clamped to a minimum of 1', () => {
  const dims = computeDimensions({ width: 1000, height: 1000 }, { percent: 0.01, lockAspect: false });
  assert.ok(Number.isInteger(dims.width));
  assert.ok(Number.isInteger(dims.height));
  assert.ok(dims.width >= 1);
  assert.ok(dims.height >= 1);
});

test('computeDimensions: throws when source dimensions are missing but aspect lock is requested', () => {
  assert.throws(() => computeDimensions({}, { width: 200, lockAspect: true }));
});

test('computeDimensions: throws when no target dimension is specified at all', () => {
  assert.throws(() => computeDimensions({ width: 800, height: 600 }, { lockAspect: true }));
});

test('PRESETS: has exactly 8 entries with the ids defined in the contract', () => {
  assert.equal(PRESETS.length, 8);
  const ids = PRESETS.map((p) => p.id);
  assert.deepEqual(ids, ['instagram', 'youtube', 'twitter', 'facebook', 'linkedin', 'hd', 'fullhd', '4k']);
});

test('PRESETS: every entry has id, label, width and height', () => {
  for (const preset of PRESETS) {
    assert.equal(typeof preset.id, 'string');
    assert.equal(typeof preset.label, 'string');
    assert.ok(Number.isInteger(preset.width) && preset.width > 0);
    assert.ok(Number.isInteger(preset.height) && preset.height > 0);
  }
});

test('PRESETS: dimensions match the contract exactly', () => {
  const expected = {
    instagram: [1080, 1080],
    youtube: [1280, 720],
    twitter: [1600, 900],
    facebook: [1200, 630],
    linkedin: [1200, 627],
    hd: [1280, 720],
    fullhd: [1920, 1080],
    '4k': [3840, 2160],
  };
  for (const preset of PRESETS) {
    const [w, h] = expected[preset.id];
    assert.equal(preset.width, w, `${preset.id} width`);
    assert.equal(preset.height, h, `${preset.id} height`);
  }
});
