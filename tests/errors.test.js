import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ImageToolsError, DecodeError, Base64Error, toUserMessage } from '../src/utils/errors.js';

// Class hierarchy ------------------------------------------------------------

test('error classes extend Error and ImageToolsError', () => {
  const base = new ImageToolsError('base');
  assert.ok(base instanceof Error);

  const decode = new DecodeError('decode failed');
  assert.ok(decode instanceof Error);
  assert.ok(decode instanceof ImageToolsError);

  const b64 = new Base64Error('bad base64');
  assert.ok(b64 instanceof Error);
  assert.ok(b64 instanceof ImageToolsError);
});

// toUserMessage --------------------------------------------------------------

test('toUserMessage: prefers a custom .userMessage when present', () => {
  const err = new ImageToolsError('internal detail');
  err.userMessage = 'Something went wrong. Please try again.';
  assert.equal(toUserMessage(err), 'Something went wrong. Please try again.');
});

test('toUserMessage: returns a non-empty friendly string for DecodeError', () => {
  const err = new DecodeError('could not decode image data');
  const msg = toUserMessage(err);
  assert.equal(typeof msg, 'string');
  assert.ok(msg.length > 0);
});

test('toUserMessage: returns a non-empty friendly string for Base64Error', () => {
  const err = new Base64Error('invalid base64 payload');
  const msg = toUserMessage(err);
  assert.equal(typeof msg, 'string');
  assert.ok(msg.length > 0);
});

test('toUserMessage: never leaks stack-trace lines from a real thrown error', () => {
  function throwsDeep() {
    throw new Error('boom');
  }
  let caught;
  try {
    throwsDeep();
  } catch (e) {
    caught = e;
  }
  assert.ok(caught.stack && caught.stack.includes('at '), 'sanity check: real errors do have "at " stack lines');

  const msg = toUserMessage(caught);
  assert.equal(typeof msg, 'string');
  assert.ok(msg.length > 0);
  assert.ok(!/\bat\s+\S+:\d+:\d+/.test(msg), `user message should not contain stack frames, got: ${msg}`);
  assert.ok(!msg.includes(caught.stack), 'user message should not embed the raw stack');
});

test('toUserMessage: does not include newline-separated stack frames', () => {
  const err = new Error('deep failure');
  const msg = toUserMessage(err);
  assert.ok(!msg.split('\n').some((line) => /^\s*at\s/.test(line)));
});
