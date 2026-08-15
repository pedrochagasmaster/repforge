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

### Media is deliberately excluded

That repository also ships `images/` and `videos/`. Those are **not** covered by
its MIT license — they belong to [Gym visual](https://gymvisual.com/) and are
redistributed there under a written permission granted to that repository
alone. Its `NOTICE.md` is explicit that cloning does not convey any license to
the media.

Taurifer therefore ships **no exercise images or animations**, and
`tools/build-exercises.mjs` never reads the media directories. Adding exercise
demo media would require a license obtained directly from Gym visual.
