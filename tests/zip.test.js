import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createZip } from '../src/utils/zip.js';

// --- Independent CRC-32 implementation (not shared with src/utils/zip.js) ---

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// --- Minimal sequential ZIP parser, spec-only, independent of src/utils/zip.js ---

function readZip(buf) {
  let offset = 0;
  const localEntries = [];

  while (buf.readUInt32LE(offset) === 0x04034b50) {
    const flags = buf.readUInt16LE(offset + 6);
    const method = buf.readUInt16LE(offset + 8);
    const crc = buf.readUInt32LE(offset + 14);
    const compressedSize = buf.readUInt32LE(offset + 18);
    const uncompressedSize = buf.readUInt32LE(offset + 22);
    const nameLen = buf.readUInt16LE(offset + 26);
    const extraLen = buf.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const name = buf.toString('utf8', nameStart, nameStart + nameLen);
    const dataStart = nameStart + nameLen + extraLen;
    const data = buf.subarray(dataStart, dataStart + compressedSize);

    localEntries.push({ flags, method, crc, compressedSize, uncompressedSize, name, data: Buffer.from(data) });
    offset = dataStart + compressedSize;
  }

  const centralEntries = [];
  while (buf.readUInt32LE(offset) === 0x02014b50) {
    const method = buf.readUInt16LE(offset + 10);
    const crc = buf.readUInt32LE(offset + 16);
    const compressedSize = buf.readUInt32LE(offset + 20);
    const uncompressedSize = buf.readUInt32LE(offset + 24);
    const nameLen = buf.readUInt16LE(offset + 28);
    const extraLen = buf.readUInt16LE(offset + 30);
    const commentLen = buf.readUInt16LE(offset + 32);
    const nameStart = offset + 46;
    const name = buf.toString('utf8', nameStart, nameStart + nameLen);
    centralEntries.push({ method, crc, compressedSize, uncompressedSize, name });
    offset = nameStart + nameLen + extraLen + commentLen;
  }

  assert.equal(buf.readUInt32LE(offset), 0x06054b50, 'expected EOCD signature at end of central directory');
  const eocd = {
    thisDiskEntryCount: buf.readUInt16LE(offset + 8),
    totalEntryCount: buf.readUInt16LE(offset + 10),
    centralDirSize: buf.readUInt32LE(offset + 12),
    centralDirOffset: buf.readUInt32LE(offset + 16),
  };

  return { localEntries, centralEntries, eocd };
}

test('createZip: produces a Blob typed as application/zip', async () => {
  const blob = await createZip([{ name: 'a.txt', blob: new Blob(['Hello, World!'], { type: 'text/plain' }) }]);
  assert.ok(blob instanceof Blob);
  assert.equal(blob.type, 'application/zip');
});

test('createZip: two entries -> valid STORE-only zip with correct headers, sizes and CRC-32', async () => {
  const entryA = { name: 'a.txt', content: 'Hello, World!' };
  const entryB = { name: 'nested/b.txt', content: 'DL Image Tools zip test 12345' };

  const blob = await createZip([
    { name: entryA.name, blob: new Blob([entryA.content], { type: 'text/plain' }) },
    { name: entryB.name, blob: new Blob([entryB.content], { type: 'text/plain' }) },
  ]);

  const buf = Buffer.from(await blob.arrayBuffer());
  const { localEntries, centralEntries, eocd } = readZip(buf);

  assert.equal(localEntries.length, 2, 'expected 2 local file headers (PK\\x03\\x04)');
  assert.equal(centralEntries.length, 2, 'expected 2 central directory headers (PK\\x01\\x02)');
  assert.equal(eocd.totalEntryCount, 2, 'EOCD (PK\\x05\\x06) should report 2 entries');
  assert.equal(eocd.thisDiskEntryCount, 2);

  const expected = [entryA, entryB];
  for (let i = 0; i < 2; i++) {
    const local = localEntries[i];
    const central = centralEntries.find((c) => c.name === expected[i].name);
    const bytes = Buffer.from(expected[i].content, 'utf8');
    const expectedCrc = crc32(bytes);

    assert.equal(local.name, expected[i].name);
    assert.equal(local.method, 0, `${expected[i].name} should be STORE (method 0), no compression`);
    assert.equal(local.compressedSize, bytes.length);
    assert.equal(local.uncompressedSize, bytes.length);
    assert.equal(local.crc >>> 0, expectedCrc, `${expected[i].name} local CRC-32 mismatch`);
    assert.deepEqual(local.data, bytes, `${expected[i].name} stored bytes should be unmodified`);

    assert.ok(central, `central directory entry for ${expected[i].name} not found`);
    assert.equal(central.method, 0);
    assert.equal(central.compressedSize, bytes.length);
    assert.equal(central.uncompressedSize, bytes.length);
    assert.equal(central.crc >>> 0, expectedCrc, `${expected[i].name} central CRC-32 mismatch`);
  }
});

test('createZip: output is readable by python3 -m zipfile', async () => {
  const blob = await createZip([
    { name: 'one.txt', blob: new Blob(['first entry'], { type: 'text/plain' }) },
    { name: 'two.txt', blob: new Blob(['second entry'], { type: 'text/plain' }) },
  ]);

  const buf = Buffer.from(await blob.arrayBuffer());
  const tmpPath = join(tmpdir(), `dl-image-tools-ziptest-${process.pid}-${Date.now()}.zip`);
  writeFileSync(tmpPath, buf);

  try {
    const result = spawnSync('python3', ['-m', 'zipfile', '-l', tmpPath], { encoding: 'utf8' });
    if (result.error && result.error.code === 'ENOENT') {
      // python3 not available in this environment; skip rather than fail the suite.
      return;
    }
    assert.equal(result.status, 0, `python3 -m zipfile exited non-zero: ${result.stderr}`);
    assert.match(result.stdout, /one\.txt/);
    assert.match(result.stdout, /two\.txt/);
  } finally {
    unlinkSync(tmpPath);
  }
});
