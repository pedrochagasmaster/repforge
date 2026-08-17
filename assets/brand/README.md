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

## `milo-hero.webp`

The first-run hero's illustration (ADR 0006): the calf-carrier grown into the
bull-carrier, 960×894. Owner-supplied art, landed 2026-08 from a 1242×1266 PNG
the product owner provided.

On a phone it is drawn a little wider than the column the poem leaves it (112%,
anchored bottom-left), so it stands on the poem's last line and the far side of
the load runs off the screen edge; past the shell's width it fits whole
instead. Both carriers and their footing stay in frame either way — that is
what the 112% is for, and much more than it starts cutting into the bull.

Two things were done to that original, and both matter if it is ever replaced:

1. **Cropped to the ink**, with about 16 px of the original's margin left on
   each side (`x 130, y 171, w 1072, h 998`). The hero's art column is only
   ~175 CSS px wide on a 390 px phone, so every pixel of empty margin in the
   file is a pixel the figures do not get. The empty band above the small
   carrier is the exception worth keeping: it is what the poem's longest lines
   sit beside.
2. **White-balanced onto the app's paper.** The drawing's own cream ground is
   `#FBF4EA`; each channel was scaled so that cream lands exactly on `--bg`
   (`#F4F2EF`), which moves the graphite and the burnt orange by under 3% and
   makes the file's rectangle invisible on the page. This is the alternative to
   what the exercise detail page does — there the artwork keeps its own paper
   and the page draws a matching field around it (`mediaBg`,
   `tools/sample-media-bg.mjs`), because those 96 files disagree about their
   paper and are shown large. One file shown small is cheaper to re-balance
   than to surround.

Then it was encoded as WebP at quality 0.9 (~100 kB). Node has no image codec
here, so the crop, the balance, and the encode were all done in the same
borrowed Chromium the tools use — a canvas draw, a per-channel multiply over
`ImageData`, and `canvas.toDataURL("image/webp", 0.9)`.

To replace it: redo those steps against the new original, keep the file name,
and bump `CACHE` in `sw.js` (the path is already in `ASSETS`; precache is
atomic, so a listed-but-missing file breaks the whole service-worker install).
Re-run `node test/install-modes.mjs`, which asserts the hero paints this file
and that nothing about it reaches a screen reader.

The hero paints it with `background-image` rather than an `<img>`: it is
decorative, the copy beside it says everything, and a missing export leaves
paper behind the copy rather than a broken-image glyph — the same line the
exercise tiles hold. No placeholder art ever stands in for it.
