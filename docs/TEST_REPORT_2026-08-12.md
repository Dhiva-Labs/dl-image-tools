# Test report — 2026-08-12

- **Tester:** automated browser pass (dev harness at `dev/dev.html`, Chromium, Linux)
- **Extension version:** 1.0.0
- **Automated unit tests:** `npm test` → 40 pass, 0 fail, 1 skipped (browser-only metadata test)

How this pass was run: the popup UI was served over `python3 -m http.server` and driven
in a real Chromium browser through the actual UI code paths (drop events on the drop
zone, tab clicks, button clicks, keyboard events) plus direct calls through
`runInWorker` — i.e. the same worker pipeline the UI uses. It is not an installed-
extension pass; items that require `chrome.*` at runtime are listed at the bottom.

## Definition-of-Done flows

| Flow | Result | Evidence |
|------|--------|----------|
| Import via drag-drop | Pass | Drop event on `.drop-zone` imports single and multiple files; tab bar appears |
| Preview | Pass | Preview element rendered after import |
| Compress | Pass | 2.6 MB JPEG → 1.8 MB WebP (29% saved, noisy source); 15 MB PNG → 3.5 MB WebP (77% saved) in 945 ms |
| Resize | Pass | 2000×1500 + width 800 + lock aspect → 800×600; 40.8 MB PNG → 1920×1554 in 348 ms |
| Convert | Pass | Transparent PNG → JPEG produced valid `image/jpeg` (alpha flattened to white, not black) |
| Crop | Pass | rect 640×360 crop of WebP → exactly 640×360 output |
| Rotate | Pass | 90° on 2000×1500 → 1500×2000 (dimensions swapped) |
| Flip | Pass | Horizontal flip of 1200×900 PNG → valid 1200×900 PNG |
| Base64 encode | Pass | tiny.png → 10,432-char data URI |
| Base64 decode | Pass | Round-trip of that data URI → `image/png` 320×240 blob |
| Batch processing | Pass | 4 files processed via "Process all"; per-file ✓ status; "Download all" enabled |
| ZIP output | Pass | `createZip` of 2 results → valid `application/zip` (PK signature); binary structure + CRC-32 + `python -m zipfile` extraction covered by `tests/zip.test.js` |
| Metadata | Pass | 2000×1500 JPEG → "2000x1500", aspect "4:3", size "2.6 MB", hasExif false (synthetic image, correct) |
| No account / no upload | Pass | No network requests besides local static files; all processing in-page |

## Error handling

| Case | Result | Evidence |
|------|--------|----------|
| Invalid Base64 | Pass | `Base64Error: "That doesn't look like valid Base64 data."` |
| Corrupted image file | Pass | Friendly "Unable to read this image. The file may be corrupted…" (no stack trace) |

## File-size tiers (Compress / Resize, worker pipeline)

| Tier | File | Time | UI responsive |
|------|------|------|----------------|
| ~35 KB | small-100k.jpg | instant | yes |
| 2.6 MB | medium-1m.jpg | <1 s | yes |
| 11.7 MB | large-5m.jpg | ~1 s | yes |
| 15 MB | huge-10m.png | 945 ms | yes |
| 40.8 MB | xl-25m.png | 348 ms (resize) | yes |

## Theme, accessibility

| Check | Result |
|-------|--------|
| Dark toggle sets `html[data-theme=dark]` | Pass |
| Theme persists (storage fallback) | Pass (`theme="dark"` in localStorage; chrome.storage.local in extension) |
| ARIA tabs + ArrowRight moves focus Compress → Resize | Pass |
| Batch tab only appears with >1 file | Pass |
| popup.html standalone loads with zero console errors | Pass |

## Not verified in this pass (requires installed extension in Chrome)

- Context menu items ("Download image", "Open in DL Image Tools") — code reviewed, needs a real right-click check after `chrome://extensions` → Load unpacked.
- Real file downloads to disk (blocked in the harness; anchor-click code path is standard).
- Paste (Ctrl+V) import with a real OS clipboard image.
- Popup close/reopen persistence via `chrome.storage.local` (verified via localStorage fallback only).
- System theme following an OS-level toggle.
- Screen-reader announcement pass.
- AVIF encode support (depends on the Chrome build; UI disables the option when unsupported).

Use `docs/TESTING.md` as the checklist for that installed-extension pass.
