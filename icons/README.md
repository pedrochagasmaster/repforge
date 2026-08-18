# Taurifer icon assets

`icon.svg` is the high-fidelity source of truth for Taurifer's app identity. It contains 9,233 genuine vector paths at a 1254×1254 view box and no embedded raster image.

- `favicon-32.png` is the browser fallback favicon.
- `icon-192.png`, `icon-512.png`, and `icon-1024.png` are install and notification assets.
- `manifest.webmanifest` lists raster icons only. `icon.svg` is linked from
  `index.html` as a favicon and must stay out of the manifest: Chrome ranks an
  `any`-sized SVG above every raster icon that does not match the device's
  launcher size exactly, and an SVG primary icon drops an Android install from a
  WebAPK to a browser shortcut (ADR 0008).
- `icon-maskable-512.png` uses a dedicated composition that keeps the complete mark and shadow inside the maskable safe circle.
- `apple-touch-icon.png` is the 180×180 iOS Home Screen asset.
- `splash-WIDTHxHEIGHT.png` files place the isolated Taurifer mark on the app's warm-mineral background for the portrait iOS/iPadOS startup images selected by `index.html`.

Android and desktop PWA splash screens are generated from `manifest.webmanifest` using the icon and `background_color`. iOS/iPadOS uses the explicit `apple-touch-startup-image` links.
