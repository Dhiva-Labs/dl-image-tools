import { test } from 'node:test';

// Per CONTRACTS.md, src/tools/metadata.js exports a single async function,
// getMetadata(file), which relies on createImageBitmap to read width/height —
// a browser-only API that does not exist in plain Node. There are no separate
// pure helper exports in the contract to unit test in isolation here.
//
// Metadata extraction (sizeLabel, aspectRatio, hasExif, megapixels, etc.) is
// instead covered by the manual test matrix in docs/TESTING.md.
test('metadata.js exposes no Node-testable pure exports (see docs/TESTING.md)', { skip: 'getMetadata requires createImageBitmap; covered by manual test plan' }, () => {});
