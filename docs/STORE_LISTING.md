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

> **Rejected 2026-08-12 (Spam and Placement, ref "Yellow Argon"):** the
> previous copy listed the resize presets by brand and resolution
> ("Instagram, YouTube, Twitter/X, Facebook, LinkedIn, HD, Full HD, 4K"),
> which the review treats as keyword stuffing. Never list platform names,
> resolutions or other keyword runs here, and don't repeat the tagline.

```
DL Image Tools is an image toolbox that runs entirely inside your browser.
Every operation happens locally using Chrome's own Canvas engine, so your
images never leave your computer. There is no server to send them to.

FEATURES
• Compress JPEG, PNG, WebP and AVIF images with an adjustable quality slider
• Resize to exact pixel dimensions or a percentage, or pick a ready-made
  preset for common social-post and screen sizes
• Convert between JPEG, PNG, WebP and AVIF
• Crop freely or to a fixed aspect ratio
• Rotate and flip images
• Encode images to base64 data URIs, or decode them back to image files
• Inspect dimensions, file size, aspect ratio, megapixels and whether the
  file carries EXIF data
• Process several images at once and download them one by one or as a
  single zip
• Right-click any image on a web page to download it or open it in
  DL Image Tools
• Light, dark and system themes

PRIVACY
Many online image tools upload your file to a server before editing it.
DL Image Tools never does. There is no account, no analytics and no ads,
and the extension makes no network requests with your image data.

DL Image Tools is open source and built by DhivaLabs.
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

No `host_permissions` are requested and the extension does not read page
content. Its only network request is "Open in DL Image Tools", which fetches
the image the user right-clicked from that image's own URL, the same way
the page already loaded it. Nothing is ever uploaded.

## Privacy tab answers

**Single purpose description:**

```
Edit images locally in the browser: compress, resize, convert, crop, rotate, flip, base64-encode and inspect images the user opens, without uploading them anywhere.
```

**Remote code:** No, I am not using remote code. All JavaScript ships in
the package; there are no external scripts, `eval` or `new Function`.

**Data usage:** tick none of the data-type boxes (the extension collects no
user data), then tick all three certifications:
- I do not sell or transfer user data to third parties, outside of the
  approved use cases
- I do not use or transfer user data for purposes that are unrelated to my
  item's single purpose
- I do not use or transfer user data to determine creditworthiness or for
  lending purposes

**Privacy policy URL:**

```
https://github.com/Dhiva-Labs/dl-image-tools/blob/main/docs/PRIVACY.md
```

## Screenshot shot list (5 shots, 1280x800 or 640x400)

1. **Compress tab, before/after.** Popup opened as a tab with an image
   loaded on the Compress tool, quality slider mid-drag, showing the
   original vs. new file size comparison.
2. **Resize tab with presets.** The Resize tool with width/height and the
   preset dropdown. Keep the dropdown closed: no platform names in shots.
3. **Crop tool in action.** The Crop tool with an active crop selection
   rectangle and aspect-ratio buttons (1:1, 16:9, 4:3...) visible.
4. **Batch mode.** Multiple thumbnails loaded in the Batch tab mid-process,
   showing per-file progress/status and the "Download all as zip" action.
5. **Right-click context menu + dark mode.** A screenshot of a web page
   with the right-click menu open on an image showing "DL Image Tools >
   Download image / Open in DL Image Tools", ideally with the extension
   popup visible in dark theme in the same or an adjacent shot.
