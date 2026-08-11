# Manual Test Plan — DL Image Tools

This is the manual verification matrix for behavior that automated
`node:test` unit tests cannot cover (anything touching Canvas, Web
Workers, `chrome.*` APIs, or real DOM interaction). Automated coverage
lives in `tests/` (`npm test`); this document covers the rest.

Fill in the **Result** / **Notes** columns during a test pass. Use
`Pass` / `Fail` / `Blocked` for Result.

- **Tester:**
- **Date:**
- **Chrome version:**
- **OS:**
- **Extension version tested:**

---

## 1. Definition-of-Done user flows

| # | Flow | Steps | Expected result | Result | Notes |
|---|------|-------|------------------|--------|-------|
| 1 | Compress | Load a JPEG, open Compress tab, drag quality slider, click download | Output file is smaller than input at low quality; downloaded file opens correctly | | |
| 2 | Resize (preset) | Load an image, open Resize tab, pick a preset (e.g. Instagram 1080x1080), download | Output dimensions exactly match the preset | | |
| 3 | Resize (custom + lock aspect) | Load an image, enter a custom width with aspect lock on | Height auto-updates proportionally; output matches | | |
| 4 | Convert | Load a PNG, convert to WebP, download | Output file has correct extension/MIME and opens as a valid WebP | | |
| 5 | Crop | Load an image, select a fixed aspect ratio (16:9), drag the crop box, download | Output dimensions match the selected region/ratio | | |
| 6 | Rotate | Load an image, rotate 90°, download | Output image is visually rotated 90°, width/height swapped | | |
| 7 | Flip | Load an image, flip horizontal, download | Output image is mirrored horizontally | | |
| 8 | Base64 encode | Load an image, open Base64 tab, copy the data URI | Data URI decodes back to the same visual image (paste into a new browser tab's address bar) | | |
| 9 | Base64 decode | Paste a valid base64/data URI string into the decode field | Image preview renders correctly; can be downloaded | | |
| 10 | Metadata | Load a JPEG with EXIF data, open Metadata tab | Correct dimensions, size, aspect ratio, megapixels; `hasExif` = true | | |
| 11 | Batch processing | Load 3+ images, run Compress on all, download as zip | Zip contains all processed images with correct names | | |
| 12 | Import methods | Import the same image via drag-and-drop, file picker, and paste (Ctrl+V) | All three import methods load the image identically | | |
| 13 | Context menu | Right-click an image on a normal web page | "DL Image Tools" submenu appears with "Download image" and "Open in DL Image Tools"; both work as described | | |

---

## 2. File-size tiers

Test with Compress and Resize at minimum; note any slowdown, freeze, or
crash. Use the same source photo re-saved/scaled to hit each rough tier.

| Size tier | File | Compress: time to complete | Resize: time to complete | UI stayed responsive? | Result | Notes |
|-----------|------|------------------------------|-----------------------------|------------------------|--------|-------|
| ~100 KB | | | | | | |
| ~1 MB | | | | | | |
| ~5 MB | | | | | | |
| ~10 MB | | | | | | |
| ~25 MB | | | | | | |

---

## 3. Format coverage

| Format | Import works | Compress | Convert (to another format) | Notes / errors |
|--------|---------------|----------|------------------------------|-----------------|
| JPG | | | | |
| PNG | | | | |
| WebP | | | | |
| Transparent PNG (alpha preserved where the target format supports it; flattened correctly when converting to JPEG) | | | | |
| Invalid file (e.g. a renamed .txt or corrupt image) | | N/A | N/A | Should show a friendly error, not crash the popup |

---

## 4. Dark mode

| Check | Result | Notes |
|-------|--------|-------|
| Theme toggle switches Light → Dark → System correctly | | |
| Dark theme persists after closing and reopening the popup | | |
| Dark theme persists when opening the UI as a full tab | | |
| System theme follows the OS light/dark setting | | |
| All tabs/tools are legible and have sufficient contrast in dark mode | | |

---

## 5. Keyboard navigation / accessibility

| Check | Result | Notes |
|-------|--------|-------|
| Tab bar is operable with arrow keys / Tab, follows ARIA tabs pattern | | |
| All interactive controls are reachable via Tab, in a logical order | | |
| Visible focus indicator on every focused control | | |
| Sliders (quality, crop handles) are operable via keyboard | | |
| Screen reader announces tab labels and control labels correctly | | |
| Ctrl+V paste import works while focus is anywhere sensible in the popup | | |

---

## 6. Batch mode (detailed)

| Check | Result | Notes |
|-------|--------|-------|
| Batch import accepts multiple files at once (drag-drop and file picker) | | |
| Per-file progress/status is visible while processing | | |
| One failing file (e.g. invalid image) does not abort the rest of the batch | | |
| Downloading a single result from a batch works | | |
| Downloading all results zips correctly (filenames, content) — see automated `tests/zip.test.js` for binary-level zip correctness | | |
| Large batch (10+ images) does not freeze the UI | | |

---

## Sign-off

| Section | Result | Blocking issues found |
|---------|--------|------------------------|
| DoD user flows | | |
| File-size tiers | | |
| Format coverage | | |
| Dark mode | | |
| Keyboard nav | | |
| Batch mode | | |
