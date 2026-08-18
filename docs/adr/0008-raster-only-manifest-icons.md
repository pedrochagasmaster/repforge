# Preserve the project-scoped manifest identity for Android WebAPK installs

Reported 2026-08: on Android, installing Taurifer from Chrome produced a
browser shortcut — the app icon with a small Chrome badge, opening in a tab
chrome rather than as its own app — instead of a WebAPK. The install offer
itself was working: Chrome fired `beforeinstallprompt`, so the site passed
every installability check (HTTPS, linked manifest, `standalone`, a service
worker with a fetch handler, icons at 192 and 512). What failed was the step
after the prompt, where Chrome asks Google's minting server to build the APK.

The first attempted fix removed the manifest's `icons/icon.svg` entry. That
made Chrome's primary-icon choice deterministic and retained valid 192, 512,
1024 and maskable PNGs, but a real-device retest still fell back to a
shortcut. The icon hypothesis was wrong: the known-working pre-rebrand
manifest already listed the SVG, and every current PNG decodes at its declared
dimensions.

The regression was the explicit `"id": "./index.html"` added after the
rebrand. Manifest `start_url`, `scope`, and icon paths resolve relative to the
manifest URL, but `id` deliberately does not: the manifest specification
resolves every relative `id` against the **origin** of `start_url`. On GitHub
Pages, Chrome therefore read:

| member | processed URL |
| --- | --- |
| `start_url: "./index.html"` | `https://pedrochagasmaster.github.io/repforge/index.html` |
| `scope: "./"` | `https://pedrochagasmaster.github.io/repforge/` |
| `id: "./index.html"` | `https://pedrochagasmaster.github.io/index.html` |

The commit said the new member pinned the identity Chrome already derived from
`start_url`, but it changed that identity from the project-scoped URL to an
out-of-scope root URL. An app id need not be in scope, so the manifest remained
valid and Chrome still fired `beforeinstallprompt`; ordinary installability
tests could not see the WebAPK failure. Chrome DevTools' processed manifest
confirmed the live mismatch exactly.

Decision: omit `id`. Per the manifest specification its processed value then
falls back to the already-correct, manifest-relative `start_url`, preserving
the pre-rebrand identity on GitHub Pages and the corresponding identity on
localhost. A deployment-specific explicit `/repforge/index.html` would fix
production but give local development a different identity.

Keep the manifest raster-only — 192, 512 and 1024 `any`, plus the maskable
512 — as a conservative input to the minting server, but do not describe the
SVG as the cause. `icons/icon.svg` remains the identity source and browser
favicon.

The service worker's shell matcher also normalizes request paths against its
registration scope. Its old root-only comparisons did not recognize
`/repforge/manifest.webmanifest` as shell content on GitHub Pages, so it could
serve a cached manifest after deployment. The v99 cache installs the corrected
manifest and the scope-relative matcher keeps subsequent shell reads
network-first.

`test/install-modes.mjs` holds the identity line by requiring `id` to remain
omitted, and retains the icon assertions: no SVG or `"sizes": "any"` entry,
192 and 512 PNGs, a maskable variant, and a fetchable file rather than a
`data:` URI for every listed icon.

A mint cannot be driven from a test: it happens on a Google server, for a real
device. The on-device check is `chrome://webapks` after installing — the app is
listed there when a WebAPK was minted, and absent when Chrome fell back to a
shortcut.
