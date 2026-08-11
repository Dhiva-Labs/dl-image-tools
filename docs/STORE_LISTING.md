# Chrome Web Store Listing — DL Image Tools

Copy-paste source for the Web Store developer dashboard. Keep this file in
sync whenever the listing copy changes.

## Store name

```
DL Image Tools
```

## Short description (max 132 characters)

```
Compress, resize, convert, crop and edit images locally in Chrome. Fast. Private. No uploads.
```

_(93 characters — leaves headroom for future edits without exceeding the
132-character limit.)_

## Detailed description

```
DL Image Tools is a fast, private image toolbox that runs entirely inside
your browser. Fast. Private. No uploads.

Every operation — compress, resize, convert, crop, rotate, flip, base64
encode/decode, and metadata inspection — happens locally using your
browser's own Canvas engine. Your images never touch a server, because
DL Image Tools doesn't have one.

FEATURES
• Compress JPEG, PNG, WebP, and AVIF with an adjustable quality slider
• Resize to exact dimensions, a percentage, or one of 8 built-in presets
  (Instagram, YouTube, Twitter/X, Facebook, LinkedIn, HD, Full HD, 4K)
• Convert between JPEG, PNG, WebP, and AVIF
• Crop freeform or to a fixed aspect ratio (1:1, 16:9, 4:3, 3:2, 9:16)
• Rotate and flip images
• Encode images to base64 / data URIs, or decode them back
• Inspect metadata: dimensions, file size, aspect ratio, megapixels, and
  EXIF presence
• Batch-process multiple images at once and download them individually or
  as a single zip
• Right-click any image on the web to download it or open it directly in
  DL Image Tools
• Light, dark, and system theme

WHY LOCAL-ONLY MATTERS
Most "online image tools" quietly upload your file to a server first. DL
Image Tools never does. There's no account, no analytics, no ads, and no
network requests carrying your image data — it's all Canvas/OffscreenCanvas
processing, right in your tab. Fast. Private. No uploads.

Open source and built by DhivaLabs.
```

## Category

**Primary suggestion:** Productivity
**Alternative:** Tools / Developer Tools (if "Productivity" is unavailable
for the target locale/category set)

## Permission justifications (for the Web Store review form)

| Permission    | Justification to submit                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------- |
| `contextMenus`| Adds a right-click menu on images with two actions: "Download image" (saves the image via Chrome's downloader) and "Open in DL Image Tools" (opens the extension's UI pre-loaded with that image). Required to offer these entry points without a permanent page-injected UI. |
| `storage`     | Persists the user's theme preference (light/dark/system) locally via `chrome.storage.local` so it's remembered between sessions. No image data or personal information is stored. |
| `downloads`   | Used to save processed images (and the right-click "Download image" action) to the user's Downloads folder via the standard Chrome download flow, instead of relying on manual anchor-click downloads. |

No `host_permissions` are requested — the extension makes no network
requests and does not need access to page content on arbitrary sites.

## Screenshot shot list (5 shots, 1280x800 or 640x400)

1. **Compress tab, before/after.** Popup opened as a tab with an image
   loaded on the Compress tool, quality slider mid-drag, showing the
   original vs. new file size comparison.
2. **Resize tab with presets.** The Resize tool with the preset dropdown
   open, showing the 8 social-media presets (Instagram, YouTube, etc.).
3. **Crop tool in action.** The Crop tool with an active crop selection
   rectangle and aspect-ratio buttons (1:1, 16:9, 4:3...) visible.
4. **Batch mode.** Multiple thumbnails loaded in the Batch tab mid-process,
   showing per-file progress/status and the "Download all as zip" action.
5. **Right-click context menu + dark mode.** A screenshot of a web page
   with the right-click menu open on an image showing "DL Image Tools >
   Download image / Open in DL Image Tools", ideally with the extension
   popup visible in dark theme in the same or an adjacent shot.
