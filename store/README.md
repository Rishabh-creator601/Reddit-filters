# Chrome Web Store listing assets

These images are for the **Web Store listing page** (uploaded in the Developer
Dashboard). They are **not** part of the extension package/zip — Chrome does not
read them from `manifest.json`. The extension's own toolbar/store icon lives in
[`../icons/`](../icons) and is referenced by the manifest.

## What's here

| File | Size | Web Store slot | Required? |
|------|------|----------------|-----------|
| `screenshot-1-filter-1280x800.png` | 1280×800 | Screenshot | ✅ At least 1 required |
| `screenshot-2-finder-1280x800.png` | 1280×800 | Screenshot | (up to 5 allowed) |
| `small-tile-440x280.png` | 440×280 | Small promo tile | Recommended |
| `marquee-1400x560.png` | 1400×560 | Marquee promo tile | Optional (needed to be featured) |

Store icon for the listing itself: use `../icons/icon128.png` (128×128).

## Chrome Web Store image spec (for reference)

- **Store icon:** 128×128 PNG. ✅ `../icons/icon128.png`
- **Screenshots:** 1280×800 **or** 640×400 PNG/JPEG. At least one required; 3–5
  recommended. ✅ Two provided at 1280×800.
- **Small promo tile:** 440×280 PNG/JPEG. ✅ Provided.
- **Marquee promo tile:** 1400×560 PNG/JPEG. ✅ Provided.

## Regenerating

The screenshots are the raw popup captures in `../docs/screenshots/` composited
onto the brand gradient. The banners and screenshots were generated with the
scripts kept alongside this repo's tooling; edit the caption text there and
re-run to refresh them.
