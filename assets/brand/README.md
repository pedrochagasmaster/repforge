# Brand art

Owner-licensed brand illustrations only — nothing here ships without a
licence covering distribution. Like `icons/icon.svg`, files here are
generated output: a new version replaces the file wholesale, never an edit.

## `mark.png`

The Taurifer yoke with no paper under it, 192×192 (48 CSS px at 4×), drawn by
the first-run gate's brand row so the mark stands on the page instead of on a
plate. It is derived from `icons/icon.svg` — the source of truth — by dropping
that file's single full-bleed ground rect and rasterising the rest:

```
(cd test && npm ci && npx playwright install chromium)   # once
node tools/build-brand-mark.mjs
```

Re-run it when a new mark lands. Never hand-edit or hand-crop the output, and
never point the gate at `icons/icon.svg` instead: the app icon paints its own
warm ground, which reads as a tile against the app's paper.

## Landing the first-run hero illustration (ADR 0006)

The first-run gate's ethos hero ships text-only until the licensed export of
the Milo illustration — the calf-carrier grown into the bull-carrier — lands
here. No placeholder icons, initials, or silhouettes in the meantime (the same
line the exercise tiles hold). The hero's layout already reserves the space and
the CSS already paints it, so landing it is two steps:

1. Export the illustration as `assets/brand/milo-hero.webp`. It fills the right
   of the hero — roughly 195×260 CSS px on a 390 px phone, behind copy that
   keeps to a 32-character mono measure on the left — and is drawn
   `contain`-fitted, anchored bottom-right. So export it cropped tight to the
   figures, roughly square or a little taller, at least 800 px on the long
   edge (≈4× the rendered box), on the paper ground (`#F4F2EF`) or
   transparent. Whatever margin the file carries is margin the copy can
   overlap, so keep it small but do not clip the art.
2. In `sw.js`, add `"./assets/brand/milo-hero.webp"` to `ASSETS` and bump
   `CACHE` — precache is atomic, so a listed-but-missing file breaks the whole
   service-worker install, and the reverse leaves the hero blank offline.

Then update the asset inventory sentence in `AGENTS.md` (the service-worker
caching note) and re-run the gates: `node test/install-modes.mjs` asserts the
hero art stays out of the accessibility tree.

The hero is painted with `background-image`, not an `<img>`, so a missing
export leaves paper behind the copy rather than a broken-image glyph. That is
also why nothing about the illustration is announced: it is decorative, and the
copy beside it says everything.
