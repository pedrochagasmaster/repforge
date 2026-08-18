# Brief assets

`taurifer-brief-assets.zip` bundles the three reference images a photorealistic
cinematic-animation brief points at. It is a hand-off bundle, not something the
app loads: nothing here is in `sw.js`'s `ASSETS`, and no new licensed art is
introduced.

| In the zip | What it is | Source |
| --- | --- | --- |
| `01-milo-and-bull-illustration.webp` | The definitive Milo-and-bull illustration — anatomy, carrying position, calf-to-bull progression, silhouette. | Copied verbatim from `assets/brand/milo-hero.webp`. |
| `02-taurifer-logo-wordmark.png` | The TAURIFER mark + wordmark lockup, to reproduce exactly. | Rendered from `icons/icon.svg` (the source of truth), dropping its single full-bleed ground rect the way `tools/build-brand-mark.mjs` does, with the wordmark at the first-run brand row's proportions from `styles.css`. |
| `03-taurifer-interface-montage.png` | The current interface — typography, spacing, restraint, brand colors. | A 5×2 montage of ten live screens (Today, exercise page with its licensed illustration, exercise progression, Progress overview / strength trend / Strength / PRs, History, Program, active workout), each a real 402×874 capture at 2× against a seeded six-week program. |

The two generated images are reproducible: serve the repo over HTTP and drive
it with the pinned test Chromium (`test/`), exactly as the browser suites do.
Only `milo-hero.webp` is fixed art; the lockup and montage re-render from the
same repo sources whenever the mark or the UI changes.
