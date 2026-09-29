# I · Ficha: the visual world

The academy's printed training card (ficha de treino), rebuilt as the whole
screen. Three materials, three meanings, never mixed:

- **Print** (Taurifer): every printed word, rule, reversed header band, and
  every row of the program. One-colour offset black on coloured sulfite.
- **Pen** (the lifter): every answer, every mark (X, tick, circle), every
  value the lifter types, every correction. BIC-blue ballpoint.
- **Stamp** (the one institutional act): the activation control, the "Ativo"
  date stamp, destructive actions and error marks. Red rubber-stamp ink.

There is no instructor hand on the card: the brief's "instructor's
ballpoint" is translated so that the only handwriting is the lifter's and
everything Taurifer contributes is printed (no counterpart that pretends to be
a person).

## Palette

Light: the stock changes per route, like colour-coded cards in a gym's card box.

| Role | Token | Value | Contrast |
| --- | --- | --- | --- |
| Recommend stock (canary) | `--card` yellow | `#F3D250` | print 11.7:1 · pen 6.6:1 · stamp text 5.6:1 |
| Paste door stock (sky) | blue | `#BCD7EC` | print 11.6:1 · pen 6.6:1 |
| File import stock | blue2 | `#CBD9E6` | print 12.0:1 |
| Custom stock | pink | `#F2C4C6` | print 11.1:1 · pen 6.3:1 · stamp text 5.4:1 |
| Browse stock | mint | `#BFE2C8` | print 12.3:1 · pen 7.0:1 |
| Build / shared stock | white | `#F3F1EA` | print 15.3:1 |
| Card box (route choice) | kraft | `#C4A67A` | print 7.4:1 (all text on kraft uses print, never soft) |
| Print | `--print` | `#1E1A15` | |
| Secondary print | `--print-soft` | `#4E4430` | ≥6.1:1 on every pastel stock |
| Pen | `--pen` | `#1C3A9C` | ≥6.3:1 on every stock |
| Stamp ink | `--stamp` / `--stamp-text` | `#B3201A` / `#9A1812` | stamp button text `#FFF8EC` 6.3:1 |
| Dialog slip / editor paper | `--paper` | `#FBF9F2` | |

Dark, **the carbon sheet**: navy-black carbon where print and pen read as pale
impressions; the route's stock survives as the 5 px top edge and the index
tabs (`--tab`).

| Role | Value | Contrast on `#161A2E` |
| --- | --- | --- |
| Carbon ground | `#161A2E` (cards `#1D2239`, box `#0E1120`) | |
| Print | `#ECE7D8` | 13.9:1 |
| Secondary | `#B8B6C9` | 8.4:1 |
| Pen impression | `#A9BDFF` | 9.3:1 |
| Stamp | `#FF7B6C` (text on it `#161A2E`) | 6.8:1 |

Colour is never the only signal: selection is an X, tick or circle; import
status is a stamped word; errors carry a sentence.

## Type

- **Sofia Sans Condensed** 600–900: the printed form (display headline,
  question headings, column heads, field labels, buttons, the stamp).
- **Sofia Sans** 400–800: running print (ledes, captions, option text, table
  rows).
- **Kalam** 400/700: the lifter's ballpoint (answer fields, pasted program,
  gap numbers, the current program name on Today). Short values only; long
  machine text (the assistant's JSON reply, the prompt) stays in the system
  monospace.
- All self-hosted under `round-4/fonts/` (OFL, Google Fonts).

## Components

- **Card head**: printed fields (label caps + dotted blank line). During the
  questions the earlier fields hold the answers in pen and are buttons back to
  that section; the current field is tinted and fills as the lifter marks; later
  fields stay blank. On the review every answer field is a button that opens the
  inline correction; a corrected value keeps the old one struck through in pen.
- **Options**: printed parentheses `( )` for single choice (marked with a drawn
  X), printed squares for multiple choice (a drawn tick), numbers circled in pen.
  Full-row targets, 54 px minimum.
- **Buttons**: reversed print band (primary), printed outline box (secondary),
  underlined print (link), red stamp block with a double inner frame
  (activation), red outline (destructive).
- **Tear-off stub**: the single pinned region, with a perforation row along its top.
- **Slip**: dialogs are a perforated paper slip over the card (scrim below).
- **Grid**: each training day is a black numbered tab plus the table
  EXERCÍCIO · SÉRIES · REPS · CARGA. The load column is deliberately blank with a
  dotted line and a note: the lifter logs the first load; Taurifer does not
  invent one. At 200% text the table reflows into labelled lines.
- **Card box**: the route choice is a stack of coloured index cards with tabs
  on a kraft ground; the canary card carries the goal question itself.
- **Stamp**: `ATIVO · 29 SET 2026` in a double-ruled frame, ink-speckled by a
  noise mask, multiply-blended on light stock.
- **Import rows**: the source name in pen, the library match printed, the status
  as a small rubber-stamped word (LIKELY in red, CONFIRMED in pen blue).

## Motion (one authored grammar: pen and stamp)

- **Escrito na ficha** (signature): picking an answer draws the X (two strokes,
  170 + 190 ms) or the circle (360 ms), and the answer is written into its field
  with a left-to-right pen reveal (620 ms, ease-out). A correction on the review
  re-writes the field beside the struck old value.
- **Printing**: entering the review prints the grid rows top to bottom (55 ms
  stagger).
- **Stamp and hand-over**: activation presses the stamp onto the finished card
  (440 ms, expo-out, blur to sharp, small thud), then after 820 ms Today opens
  with the stamped card edge sliding in.
- Reduced motion: every animation is 0 s (the harness rule) and the stamp step
  is skipped; Today opens at once with the stamp already on its card edge.

## Accessibility notes

44 px minimum everywhere (fields 50 px, options 54 px, buttons 54 px); focus is a
3 px pen-blue outline; focus stays on the marked option after every answer and
returns to the opener from every slip; the decorative blank card on the landing
is one `role="img"` with a sentence.
