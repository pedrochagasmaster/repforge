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
vocabulary. Portuguese names are Taurifer's own — composed from the phrase
tables in `tools/exercise-vocabulary.mjs`, not taken from the dataset's
multilingual instruction text.

The library covers the dataset in full: 1,284 of its 1,324 rows. The 40 it does
not carry are listed with a reason in `tools/exercise-curation-excluded.json`,
and every one of them is a row the dataset names twice — "v. 2" variants,
"(male)"/"(female)" pairs, camera-angle splits, and word-order spellings of one
movement.

### The dataset's media is deliberately excluded

That repository also ships `images/` (1,324 stills) and `videos/` (1,324
animated GIFs). Those are **not** covered by its MIT license — they belong to
[Gym visual](https://gymvisual.com/) and are redistributed there under a
written permission granted to that repository alone. Both its `LICENSE`
("MEDIA EXCEPTION") and its `NOTICE.md` are explicit that cloning conveys no
license to the media and that a reuser must obtain their own from Gym visual.

This is why expanding the library did not expand the artwork. Taking the
dataset's 1,324 GIFs would be redistributing someone else's licensed media
without a license, whatever the app around them looks like. The data half is
MIT and Taurifer now uses all of it; the media half needs a license from Gym
visual, and until there is one those movements render the empty tile.

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
no image request — 1,188 of the 1,284 movements are in that state.
