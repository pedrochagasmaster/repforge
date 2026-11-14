# Catalog comparator fixtures

`stale-execution-mode-430.png` starts with the committed current frame. Only
x=350..839, y=1670..1697 comes from the pre-#520 endpoint-control baseline at
e16f48a50. `test/ci.mjs` places this deliberately stale fixture in a temporary
catalog and exercises the real verify gate. It never overwrites the catalog.

The JSON files retain small RGB crops, not replacement catalog frames. Each
record identifies its source frame, CI run and crop bounds. `baseline` and
`current` are base64-encoded zlib RGB8 bytes; `test/ui-screens.mjs` places them
at their original coordinates and frame dimensions before comparison.

- `raster-fringe-glyphs.json`: unchanged text at 200% text size, behind a
  dimming scrim, and on a filled CTA. Raster variation must pass.
- `changed-size-glyph.json`: the backup-size label changed from 162 KB to
  163 KB. That content change must fail, despite its small size.

The glyph crops come from CI run 43563575943 on
2bd8c4a9b72a64030c3dd28eed4f972fa65bfdd6 and its committed baselines. The
classification review leaves every catalog PNG untouched.
