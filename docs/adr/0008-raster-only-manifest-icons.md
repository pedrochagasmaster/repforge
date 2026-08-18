# The manifest lists raster icons only, so Android installs mint a WebAPK

Reported 2026-08: on Android, installing Taurifer from Chrome produced a
browser shortcut — the app icon with a small Chrome badge, opening in a tab
chrome rather than as its own app — instead of a WebAPK. The install offer
itself was working: Chrome fired `beforeinstallprompt`, so the site passed
every installability check (HTTPS, linked manifest, `standalone`, a service
worker with a fetch handler, icons at 192 and 512). What failed was the step
after the prompt, where Chrome asks Google's minting server to build the APK.

The cause was the manifest's first icon entry: `icons/icon.svg` at
`"sizes": "any"`. Chromium's `ManifestIconSelector` ranks an `any`-sized SVG
second only to a raster icon whose height matches the device's ideal icon size
*exactly* (`best_delta == 0`); Android's ideal home-screen size is the
launcher's icon size in device pixels, which is rarely exactly 192 or 512. So
on most phones the SVG — 2.3 MB of vector paths, generated output we never
optimize — became the WebAPK's primary icon. Chrome forwards PNG and JPEG
primary icons to the minting server as raw bytes, but any other type has to be
re-downloaded and rasterised in the browser first, and a failure there hands
the server no usable primary icon. An SVG primary icon has a long history of
sinking the mint, and a failed mint silently degrades to a shortcut.

Decision: `manifest.webmanifest` lists raster icons only — 192, 512 and 1024
`any`, plus the maskable 512. `icons/icon.svg` stays the app's identity source
of truth and stays linked from `index.html` as the browser favicon
(`<link rel="icon" type="image/svg+xml">`), which is the surface it was always
crisp on; nothing on a Home Screen renders it. Removing it from the manifest
costs nothing visible and makes the primary-icon choice deterministic: the PNG
closest to the device's ideal size, sent to the minting server as bytes.

`test/install-modes.mjs` holds the line — it asserts the manifest declares no
SVG and no `"sizes": "any"` entry, that a 192 and a 512 PNG are both present
with a maskable variant, and that every icon it lists is a fetchable file
rather than a `data:` URI.

A mint cannot be driven from a test: it happens on a Google server, for a real
device. The on-device check is `chrome://webapks` after installing — the app is
listed there when a WebAPK was minted, and absent when Chrome fell back to a
shortcut.
