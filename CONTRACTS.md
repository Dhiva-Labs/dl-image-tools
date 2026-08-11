# DL Image Tools — Module Contracts (v1)

All agents MUST code exactly against these APIs. Plain ES modules, no TypeScript,
no build step, no external runtime dependencies. Chrome Extension Manifest V3.

Every `source` parameter below accepts a `File`, `Blob`, or `ImageBitmap`.
Every processing function is `async` and returns `Promise`.
Every module must clean up object URLs / bitmaps it creates.

## src/utils/image.js
```js
export async function decodeImage(source)            // -> ImageBitmap (throws DecodeError w/ friendly .message)
export function canvasFrom(bitmap, w = bitmap.width, h = bitmap.height) // -> OffscreenCanvas (bitmap drawn scaled to w×h)
export async function canvasToBlob(canvas, type, quality)  // -> Blob; type: 'image/jpeg'|'image/png'|'image/webp'|'image/avif'
export async function isTypeSupported(type)          // -> boolean (encode support, cached; AVIF may be false)
export function formatBytes(n)                       // -> '2.4 MB' style string
export function outputFilename(inputName, suffix, ext) // 'photo.jpg','-compressed','webp' -> 'photo-compressed.webp'
export const MIME_TO_EXT   // { 'image/jpeg':'jpg', 'image/png':'png', 'image/webp':'webp', 'image/avif':'avif' }
export const ACCEPTED_TYPES // ['image/jpeg','image/png','image/webp','image/avif','image/gif','image/bmp']
```

## src/utils/download.js
```js
export function downloadBlob(blob, filename)   // anchor-click download, revokes URL after
export async function downloadAll(entries)     // entries: [{blob, filename}]; if >1, zips via utils/zip.js -> 'dl-image-tools.zip'
```

## src/utils/zip.js  (STORE-only ZIP, no compression, no deps)
```js
export async function createZip(entries)  // entries: [{name: string, blob: Blob}] -> Blob('application/zip')
// Must produce a valid ZIP readable by unzip/Explorer/Finder. CRC-32 required.
```

## src/tools/compressor.js
```js
export async function compress(source, { format, quality })
// format: 'image/jpeg'|'image/webp'|'image/avif'|'image/png'; quality: 0..1 (ignored for png)
// -> { blob, width, height }
```

## src/tools/resizer.js
```js
export function computeDimensions({ width, height }, opts)
// opts: { width?, height?, percent?, lockAspect: bool } -> { width, height } (integers >= 1)
// lockAspect + only one dimension given -> derive other. percent overrides w/h.
export async function resize(source, opts)  // opts as above + { format?, quality? } -> { blob, width, height }
export const PRESETS
// [{ id:'instagram', label:'Instagram Post', width:1080, height:1080 },
//  { id:'youtube', label:'YouTube Thumbnail', width:1280, height:720 },
//  { id:'twitter', label:'Twitter/X Post', width:1600, height:900 },
//  { id:'facebook', label:'Facebook Post', width:1200, height:630 },
//  { id:'linkedin', label:'LinkedIn Post', width:1200, height:627 },
//  { id:'hd', label:'HD (1280×720)', width:1280, height:720 },
//  { id:'fullhd', label:'Full HD (1920×1080)', width:1920, height:1080 },
//  { id:'4k', label:'4K (3840×2160)', width:3840, height:2160 }]
```

## src/tools/converter.js
```js
export async function convert(source, format, quality = 0.92) // -> { blob, width, height }
```

## src/tools/cropper.js
```js
export async function crop(source, rect, { format?, quality? } = {})
// rect: { x, y, width, height } in natural-image pixels, clamped to bounds -> { blob, width, height }
export const ASPECT_RATIOS
// [{ id:'free', label:'Free', ratio:null }, { id:'square', label:'1:1', ratio:1 },
//  { id:'16-9', label:'16:9', ratio:16/9 }, { id:'4-3', label:'4:3', ratio:4/3 },
//  { id:'3-2', label:'3:2', ratio:3/2 }, { id:'9-16', label:'9:16', ratio:9/16 }]
```

## src/tools/transformer.js
```js
export async function rotate(source, degrees, { format?, quality? } = {}) // 90|180|270 -> { blob, width, height }
export async function flip(source, axis, { format?, quality? } = {})      // 'horizontal'|'vertical' -> { blob, width, height }
```

## src/tools/metadata.js
```js
export async function getMetadata(file) // File ->
// { name, type, sizeBytes, sizeLabel, width, height, aspectRatio /* '4:3' or '1.85:1' */,
//   lastModified /* Date|null */, hasExif /* bool: JPEG APP1 'Exif' scan */, megapixels }
```

## src/tools/base64.js
```js
export async function toBase64(file)      // -> { base64, dataUri, sizeLabel, charCount }
export async function fromBase64(input)   // raw base64 OR data URI; whitespace-tolerant.
// -> { blob, mime, width, height, objectUrl }  (throws Base64Error w/ friendly .message on invalid input)
export function detectMime(bytes)         // Uint8Array -> 'image/png'|'image/jpeg'|'image/webp'|'image/gif'|null (magic numbers)
```

## src/storage/settings.js
```js
export async function getSetting(key, fallback)   // chrome.storage.local; localStorage fallback when chrome absent (dev)
export async function setSetting(key, value)
export async function getTheme()                  // -> 'light'|'dark'|'system'
export async function setTheme(theme)
export function applyTheme(theme)                 // sets document.documentElement.dataset.theme ('light'|'dark'; resolves 'system' via matchMedia)
```

## src/utils/errors.js
```js
export class ImageToolsError extends Error {}   // .userMessage = friendly text
export class DecodeError extends ImageToolsError {}
export class Base64Error extends ImageToolsError {}
export function toUserMessage(err)  // any error -> friendly string, never a stack trace
```

## src/background/service-worker.js  (module type)
- On install: create context menu (contexts: ['image']) parent "DL Image Tools" with children
  "Download image" (chrome.downloads.download({url: srcUrl})) and
  "Open in DL Image Tools" (chrome.tabs.create popup.html?src=<encoded srcUrl> — popup.js fetches it; on CORS failure shows friendly error).
- Permissions used: contextMenus, storage, downloads. NOTHING else. No host_permissions in v1.

## src/popup/  (popup.html, popup.css, popup.js + src/components/*.js)
- popup.html is the single page (used as browser-action popup AND opened as a tab).
- Tab bar: Compress | Resize | Convert | Crop | Rotate/Flip | Base64 | Metadata | Batch
- Import: drag-drop zone, file input (multiple), paste (Ctrl+V) handler.
- Theme toggle (light/dark/system) persisted via storage/settings.js.
- Footer: "Your images stay on your device."
- Heavy processing calls run through src/utils/worker-client.js (below); UI shows busy state, never freezes.
- Accessibility: all controls labelled, keyboard navigable, visible focus, ARIA tabs pattern.
- min-width 640px when opened as tab is fine; popup body 520px wide, max-height 600px.

## src/utils/worker-client.js + src/utils/worker.js
```js
// worker-client.js
export async function runInWorker(op, args, transfer = []) // op: 'compress'|'resize'|'convert'|'crop'|'rotate'|'flip' -> result from tools module
// worker.js: module Web Worker; imports tools modules; postMessage protocol {id, op, args} -> {id, ok, result|error:{message}}
// Fallback: if Worker/OffscreenCanvas unavailable, worker-client runs the tools module directly on main thread.
```

## Dev harness (dev/)
- dev/chrome-shim.js: minimal window.chrome stub (storage.local via localStorage, runtime.getURL, downloads no-op) — imported ONLY by dev/dev.html.
- dev/dev.html: loads popup UI standalone for browser testing (iframe-free; script type=module).
- Never referenced from manifest.json.

## tests/ (node:test, zero deps; only pure logic — no canvas)
- tests/*.test.js run via `npm test` -> `node --test tests/`
- Cover: computeDimensions, outputFilename, formatBytes, base64 validation/detectMime, zip binary structure (parse local headers + EOCD, CRC values), aspectRatio string logic, toUserMessage.

## Conventions
- 2-space indent, semicolons, single quotes, `const` first.
- No console.log left in production paths (console.error for real errors OK).
- All user-visible strings in English, sentence case.
- Default output format: same as input except AVIF-in -> WebP-out when AVIF encode unsupported.
- Default quality 0.8 (UI slider 1–100 mapped to 0.01–1).
