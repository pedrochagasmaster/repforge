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

### The dataset's media is deliberately excluded

That repository also ships `images/` and `videos/`. Those are **not** covered by
its MIT license — they belong to [Gym visual](https://gymvisual.com/) and are
redistributed there under a written permission granted to that repository
alone. Its `NOTICE.md` is explicit that cloning does not convey any license to
the media.

The Taurifer application uses **none** of it. `tools/build-exercises.mjs` reads
only `data/exercises.json` and never opens the media directories, and
`test/exercise-library.mjs` fails if a generated entry so much as mentions an
upstream media path. Using that project's demo media would require a license
obtained directly from Gym visual.

#### Exception: the style-transfer experiment pack

`taurifer-style-transfer-experiment-pack-v4-codex-judge.zip` at the repository
root is a research artifact, not part of the shipped application. It contains
four `reference_exdb_*.jpg` frames and a contact sheet derived from that
dataset's `videos/` directory — that is, from the Gym visual media described
above. Their provenance is recorded in the pack's
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
