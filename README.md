# DL Image Tools

A privacy-first, fully-local image toolbox for Chrome, by **DhivaLabs**.

Compress, resize, convert, crop, rotate, flip, and inspect images — right in
your browser, with nothing ever leaving your device.

> Your images stay on your device. Always.

## Why

Most "free online image tools" are upload-to-a-server tools wearing a nice
UI. DL Image Tools does the opposite: every operation runs locally in your
browser using the Canvas/OffscreenCanvas APIs. No image byte you touch is
ever sent anywhere.

## Features

- **Compress** — re-encode JPEG/WebP/AVIF/PNG with an adjustable quality
  slider to shrink file size.
- **Resize** — exact dimensions, percentage scaling, aspect-lock, or one of
  8 built-in presets (Instagram, YouTube, Twitter/X, Facebook, LinkedIn, HD,
  Full HD, 4K).
- **Convert** — switch between JPEG, PNG, WebP and AVIF (where the browser
  supports encoding it).
- **Crop** — freeform or fixed aspect ratios (1:1, 16:9, 4:3, 3:2, 9:16).
- **Rotate / Flip** — 90°/180°/270° rotation, horizontal or vertical flip.
- **Base64** — convert an image to a base64 string / data URI and back.
- **Metadata** — inspect dimensions, file size, aspect ratio, megapixels,
  and whether a JPEG carries EXIF data.
- **Batch** — run any of the above across multiple images at once, and
  download the results individually or as a single zip.
- **Right-click menu** — "Download image" or "Open in DL Image Tools"
  straight from any image on the web.
- **Light / dark / system theme.**

## Privacy

DL Image Tools does not have a server, an account system, or an analytics
SDK. Every image operation runs locally in an in-page `OffscreenCanvas` (or
a Web Worker, so the UI never freezes). The only thing ever written to
`chrome.storage.local` is your theme preference — never image data. See
[`docs/PRIVACY.md`](docs/PRIVACY.md) for the full policy.

## Install

### From the Chrome Web Store

_Coming soon — DL Image Tools is pending Chrome Web Store review._
`[Chrome Web Store link placeholder]`

### Load unpacked (development / early access)

1. Clone or download this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the `dl-image-tools/` project folder
   (or the `dist/dl-image-tools/` folder produced by the build script, see
   below).
5. Pin the extension for quick access from the toolbar.

## Development

There is **no build step** required to develop or run the extension —
`src/` is plain ES modules loaded directly by the browser.

```bash
# Run the unit test suite (Node's built-in test runner, zero dependencies)
npm test

# Preview the popup UI standalone in a regular browser tab, without loading
# the extension into Chrome (uses dev/chrome-shim.js to stub the chrome.* APIs)
open dev/dev.html   # or just open the file in a browser

# Produce a distributable build (dist/dl-image-tools/ + a Web Store zip)
npm run build        # -> scripts/build.sh
```

### Project layout

```
manifest.json                 Chrome Extension (MV3) manifest
src/
  background/service-worker.js  Context menus ("Download image" / "Open in DL Image Tools")
  popup/                        popup.html/css/js — the single UI, used as the toolbar popup and as a standalone tab
  components/                   Popup UI building blocks
  tools/                        Pure-ish image operations: compressor, resizer, converter, cropper, transformer, metadata, base64
  utils/                        image/canvas helpers, download, zip, worker-client, errors
  storage/                      chrome.storage.local wrapper + theme handling
public/icons/                 Extension icons
dev/                           Standalone browser preview harness (never shipped, never referenced by manifest.json)
tests/                         node:test unit tests for pure logic
scripts/build.sh               Release build script
docs/                          Privacy policy, store listing copy, manual test plan
```

### Architecture overview

```
popup UI (src/popup, src/components)
   │  user picks images + a tool + options
   ▼
worker-client.js  ──dispatch──▶  worker.js (Web Worker)
   │  (falls back to main thread if Worker/OffscreenCanvas is unavailable)
   ▼
tools/*.js  (compressor, resizer, converter, cropper, transformer, base64, metadata)
   │  decode → draw on OffscreenCanvas → re-encode
   ▼
utils/download.js  →  single file download, or utils/zip.js for a batch zip
```

The background **service worker** (`src/background/service-worker.js`) is
independent of this pipeline — it only manages the right-click context menu
on images and either downloads the image directly or opens the popup UI as
a tab pre-loaded with the clicked image's URL.

## Permissions

| Permission    | Why it's needed                                                                 |
| ------------- | -------------------------------------------------------------------------------- |
| `contextMenus`| Adds the "DL Image Tools" right-click menu (Download image / Open in DL Image Tools) on images. |
| `storage`     | Persists your theme preference (light/dark/system) locally via `chrome.storage.local`. Never used for image data. |
| `downloads`   | Lets "Download image" and the in-app download buttons save files to disk without an intermediate `<a>` click prompt. |

No `host_permissions` are requested in v1 — DL Image Tools never talks to
the network.

## Known limitations

- **AVIF encoding** depends on your Chrome build's codec support. If your
  browser can't encode AVIF, DL Image Tools automatically falls back to
  WebP output.
- **EXIF metadata is not preserved** on compress/resize/convert/crop/rotate
  operations. Re-encoding through canvas strips it by design — this is a
  privacy feature (no accidental leakage of GPS/camera metadata in your
  output files), not a bug. The **Metadata** tool can still read and show
  you the EXIF presence of your original file before you process it.
- **SVG is not supported.** DL Image Tools operates on raster formats
  (JPEG, PNG, WebP, AVIF, GIF, BMP as input); SVG is a vector format and is
  out of scope for v1.

## License

MIT. See the `license` field in `package.json`.
