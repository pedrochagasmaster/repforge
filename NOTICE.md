# Third-party notices

## Exercise library data

`exercises.js` is generated from the movement data in
[hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset),
used under the MIT License:

```text
MIT License

Copyright (c) 2026 Hasan Emir Yıldırım

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation and data files (the "Software"),
to deal in the Software without restriction, including without limitation the
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
sell copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Taurifer uses only the **non-media** portion of that dataset: movement names,
equipment, and muscle tags, remapped to Taurifer's own equipment and muscle
vocabulary and reduced to a curated subset. Portuguese names are Taurifer's own.

### Exercise animations (Gym visual)

That repository also ships `images/` and `videos/`. Those are **not** covered by
its MIT license. They belong to [Gym visual](https://gymvisual.com/), and that
repository's `NOTICE.md` is explicit that cloning it does not convey any license
to the media.

Taurifer vendors a subset of the `videos/` animations under
`assets/exercise-gifs/` on the strength of a separate permission from Gym visual
that the project owner holds (recorded here on 2026-11-24). They remain the
property of Gym visual, governed by its
[Terms & Conditions of Use](https://gymvisual.com/content/3-terms-and-conditions-of-use),
and this repository grants no rights to them. The terms Taurifer follows:

- **Attribution:** every use carries **© Gym visual — https://gymvisual.com/**.
  The product shows it in Settings.
- **Resolution:** the files are kept at **180×180**, byte-for-byte as published.

Only movements whose catalog name equals exactly one dataset name (case and
punctuation folded, no fuzzy or alias matching) are vendored: 61 files, pinned
to dataset commit `7455efae41b330c265e7cd4b78dfa848e7ce5ebd` and to a content
hash each in `tools/exercise-gifs.json`. `tools/vendor-exercise-gifs.mjs`
produces that set and `test/exercise-library.mjs` fails on any file outside it.
The dataset's `images/` directory and every other animation stay excluded.

#### The style-transfer experiment pack

`taurifer-style-transfer-experiment-pack-v4-codex-judge.zip` at the repository
root is a research artifact, not part of the shipped application. It contains
four `reference_exdb_*.jpg` frames and a contact sheet derived from that
dataset's `videos/` directory — that is, from the Gym visual media described
above, outside the vendored set. Their provenance is recorded in the pack's
`benchmark/selected_pairs_manifest.csv`. They are **not** covered by the
dataset's MIT license, no license to them is granted by this repository, and
nothing in the app reads them.

## Exercise illustrations

The 96 illustrations in `assets/exercises/` are separate artwork licensed for
use in this app. They have no relationship to the dataset above: they are keyed
by Taurifer library id rather than by upstream id, and they are not derived from
any upstream media.

`MEDIA_IDS` in `tools/build-exercises.mjs` is the allowlist. A movement with no
entry there carries no media path at all, so it renders an empty tile and issues
no image request — 174 of the 270 movements are in that state.

## Motion animation runtime

`vendor/motion/motion.js` is a generated bundle of
[Motion](https://motion.dev/) (npm package `motion`), used under the MIT
License:

```text
MIT License

Copyright (c) 2018 Framer B.V.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

The bundle is vendored rather than fetched: Taurifer ships no runtime CDN
dependency and must animate identically offline. It is pinned by version and
content hash in `vendor/motion/motion.pin.json`, regenerated by
`node tools/build-vendor-runtimes.mjs`, and precached by the service worker
alongside the rest of the app shell. Only the exports named in
`tools/vendor-runtimes/motion.entry.mjs` are bundled; the rest of the package is
tree-shaken away.

## Drag and drop

`vendor/dnd-kit/dnd-kit.js` is a generated bundle of
[@dnd-kit/dom](https://github.com/clauderic/dnd-kit) (npm package
`@dnd-kit/dom`), used under the MIT License:

```text
MIT License

Copyright (c) 2021, Claudéric Demers

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

It powers reordering in the program editor — the pointer drag, the keyboard
drag, collision detection and auto-scrolling. Like Motion it is vendored rather
than fetched, pinned by version and content hash in
`vendor/dnd-kit/dnd-kit.pin.json`, regenerated by
`node tools/build-vendor-runtimes.mjs`, and precached by the service worker.
Only the exports named in `tools/vendor-runtimes/dnd-kit.entry.mjs` are
bundled. Its screen-reader announcements are replaced with Taurifer's own
localised strings; the library's English defaults never reach a Portuguese
install.
