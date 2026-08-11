# Privacy Policy — DL Image Tools

**Last updated:** 2026-08-12

DL Image Tools ("the extension") is developed by DhivaLabs. This policy
explains what the extension does — and, more importantly, does not do —
with your data.

## Summary

**All image processing happens locally, on your device, inside your
browser. DL Image Tools does not upload your images anywhere, does not run
analytics, and does not have user accounts.**

## What DL Image Tools does

- Reads image files you explicitly open (via drag-and-drop, the file
  picker, paste, or the "Open in DL Image Tools" right-click menu item) to
  process them — compress, resize, convert, crop, rotate, flip, encode to
  base64, or read metadata.
- Performs that processing entirely in-browser using the Canvas /
  OffscreenCanvas APIs, optionally inside a Web Worker so the UI stays
  responsive.
- Lets you download the resulting file(s) using Chrome's native download
  mechanism.
- Stores your theme preference (light / dark / system) locally using
  `chrome.storage.local`.
- Adds a right-click context menu on images ("Download image" and "Open in
  DL Image Tools") to let you act on any image on a web page.

## What DL Image Tools does NOT do

- **No uploads.** Image bytes never leave your device. There is no backend
  server for the extension to send data to, and the extension requests no
  `host_permissions` in its manifest.
- **No analytics or telemetry.** There is no usage tracking, crash
  reporting, or third-party SDK of any kind.
- **No accounts.** There is no sign-in, no user identifier, and nothing
  tying your usage back to you.
- **No ads.**
- **No sale or sharing of data**, because none is collected in the first
  place.

## Data stored locally

The only data DL Image Tools persists is stored via `chrome.storage.local`
(or `localStorage` when previewed outside the extension shell) and never
leaves your machine:

| Key                | Purpose                                   |
| ------------------ | ------------------------------------------ |
| Theme preference    | Remembers whether you chose light, dark, or system theme. |
| UI preferences      | Small non-sensitive UI state (e.g. last-used tool/tool options), if applicable. |

No image, filename, or file content is ever written to this storage.

## Context menu downloads

When you use "Download image" from the right-click menu, the extension
calls Chrome's own `chrome.downloads` API with the image's URL directly —
the image is downloaded straight from the site that served it, through
Chrome's downloader. DL Image Tools does not fetch, proxy, or see the
bytes of that download itself.

When you use "Open in DL Image Tools", the extension opens its popup UI as
a full tab with the image's URL passed along so the tool can load it for
processing. That fetch happens the same way any page-embedded image
request would (subject to the source site's CORS policy) — again, nothing
is routed through a DhivaLabs server, because there isn't one.

## Permissions

See the permissions table in [`README.md`](../README.md) and
[`STORE_LISTING.md`](STORE_LISTING.md) for a justification of each
permission the extension requests (`contextMenus`, `storage`,
`downloads`). No `host_permissions` are requested.

## Changes to this policy

If this policy changes, the updated version will be published alongside a
new extension release with an updated "Last updated" date above.

## Contact

Questions about this policy can be directed to DhivaLabs via the support
contact listed on the extension's Chrome Web Store listing.
