# Taurifer icon assets

`icon.svg` is the flat vector source of truth for Taurifer's app identity: a charcoal bull-horn T — a yoke beam with upturned horn tips over a tapered stem — carrying a copper load line, on warm paper.

- `favicon-32.png` is the browser fallback favicon.
- `icon-192.png`, `icon-512.png`, and `icon-1024.png` are install and notification assets.
- `icon-maskable-512.png` keeps the full-bleed artwork inside the maskable safe area.
- `apple-touch-icon.png` is the 180×180 iOS Home Screen asset.
- `splash-WIDTHxHEIGHT.png` files are portrait iOS/iPadOS startup images selected by the media queries in `index.html`.

Android and desktop PWA splash screens are generated from `manifest.webmanifest` using the icon and `background_color`. iOS/iPadOS uses the explicit `apple-touch-startup-image` links.
