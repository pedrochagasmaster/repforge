# Brand art

Owner-licensed brand illustrations only — nothing here ships without a
licence covering distribution. Like `icons/icon.svg`, files here are
generated output: a new version replaces the file wholesale, never an edit.

## Landing the first-run hero illustration (ADR 0006)

The first-run gate's ethos hero deliberately ships text-only until the
licensed export of the Milo illustration — the calf-carrier grown into the
bull-carrier — lands here. No placeholder icons, initials, or silhouettes in
the meantime (the same line the exercise tiles hold).

To land it:

1. Export the illustration as `assets/brand/milo-hero.webp`. It anchors to
   the right of an ink (`#1B1A17`) panel roughly 345×150 CSS px on a 390 px
   phone, behind copy that keeps to the left ~55% — so export on the ink
   ground (or transparent), cropped tight, at least 800 px on the long edge
   (2× the rendered box).
2. In `index.html`, add the image as the hero panel's first child, exactly
   as the comment there shows:
   `<img class="firstrun-hero__art" src="assets/brand/milo-hero.webp" alt="">`
   (decorative — the empty `alt` is doctrine; add `width`/`height` matching
   the export's intrinsic size). The CSS rule `.firstrun-hero__art` already
   positions it.
3. In `sw.js`, add `"./assets/brand/milo-hero.webp"` to `ASSETS` and bump
   `CACHE` — precache is atomic, so a listed-but-missing file breaks the
   whole service-worker install (and the reverse leaves the hero blank
   offline).
4. Update the asset inventory sentence in `AGENTS.md` (the service-worker
   caching note) to mention the brand illustration.
5. Re-run the gates: `node test/install-modes.mjs` asserts any hero art
   stays decorative (`alt=""`).
