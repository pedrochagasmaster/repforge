# K · Linhas: the world

São Paulo Metrô wayfinding, used as a working system, not a mood board. It
covers the line map, the in-car one-line diagram (diagrama unifilar), the
station-name band with its line stripe, roundels, station dots on thick
coloured rules, pictogram tiles and the tactile safety edge of the platform.
Nothing here copies the Metrô's own logo or claims to be the Metrô. The world
lives in `k.css` (tokens on `:root`, dark on `:root[data-theme="dark"]`),
and `k.js` renders every atom in it.

## Palette

Colour strategy: **full palette**. Five line colours each carry one route,
and ink and white do everything else. A line colour never stands alone as a
signal: there is always a number, a name, a check or a shape as well.

| Role | Light | Dark | Contrast (measured) |
| --- | --- | --- | --- |
| Ground (platform concrete) `--k-ground` | `#E6E8E5` | `#0B0D0F` | ink on ground 15.5 / 17.0 |
| Panel (white enamel) `--k-panel` | `#FFFFFF` | `#15181B` | — |
| Ink `--k-ink` | `#0E1012` | `#EEF0EC` | — |
| Secondary text `--k-ink-2` | `#3D4247` | `#AEB5BA` | 8.2 on ground, 10.2 on panel / 9.4 on ground, 8.6 on panel |
| Station band `--k-sign` / `--k-sign-ink` | `#0E1012` / `#FFFFFF` | `#EEF0EC` / `#0B0D0F` (backlit sign) | 15+ / 17.0 |
| Linha 1 Azul, Recomendar `--k-l1` | `#0455A1` + white | `#4A97EC` + dark ink | 7.4 / 6.4 |
| Linha 2 Verde, Personalizar `--k-l2` | `#007E5E` + white | `#22B98E` + dark ink | 5.1 / 7.8 |
| Linha 3 Vermelha, Programas prontos `--k-l3` | `#D1261E` + white | `#FF6154` + dark ink | 5.2 / 6.6 |
| Linha 4 Amarela, Montar do zero `--k-l4` | `#FFD400` + ink | `#FFD400` + dark ink | 13.3 |
| Linha 5 Lilás, Trazer o seu `--k-l5` | `#9B3894` + white | `#CD83C8` + dark ink | 6.2 / 7.1 |
| Safety yellow (platform edge, warnings) `--k-safety` | `#FFCE00` | `#E8BC00` | decorative band; text on it is ink |
| Destructive `--k-danger` | `#B3261E` | `#FF8A80` | 5.3 / 8.5, always with a dashed border |

The yellow line is only 1.2:1 against the ground, so every yellow rule, dot
and roundel carries a 1.5 px ink casing. The real Linha 3 red (`#EE372F`)
fails white text at small sizes, so the world deepens it to `#D1261E`.

## Type

- **Archivo** (400–800, self-hosted variable font under `round-4/fonts/archivo/`):
  station names, headings, body and controls. It is a sturdy grotesque in the
  signage tradition. Helvetica, the historical Metrô face, is not open.
- **Archivo Narrow** (500–700, `round-4/fonts/archivo-narrow/`): station labels
  under the dots, counts, facts, badges and the prescriptions (`3 × 8–12`).
  This is the narrow signage register that fits PT-BR labels under five dots.
- Scale: the station name is `min(2.25rem, 10.5vw)` in 700, the landing
  headline `min(2.375rem, 9.8vw)` in 800, the question line `min(1.375rem, 10vw)`,
  group labels 1.0625rem in 700, and body 1rem at 1.45. Display sizes are capped
  in `vw` so that at 200% text no word overflows at 320 px. Body and controls
  still double. Numbers use tabular figures.
- There are no eyebrows or kickers. The roundel sits beside the station name,
  never above it.

## Components

- **Station band (`.k-sign`)**: a full-bleed black band (a lit light band in
  dark) with the route roundel and the station name as the h1, and a 10 px
  line-colour stripe under it. The map's band carries all five colours.
- **Diagrama unifilar (`.k-strip`)**: this is the signature. It is a white strip
  under a 3 px ink rule with the roundel, "Linha N · name" and the count of
  stations left. A thin rule shows the stations still ahead and a thick rule
  shows the ones passed. A passed station is a filled dot with a check, and
  under it the lifter's own answer ("3 dias · 60 min", "Academia completa").
  Passed question stations are buttons that jump back. The current station is
  a large white dot inside an ink ring and a line-colour halo. The terminal is a
  capsule, "Seu programa". At 200% text or below 360 px the labels hide, the
  dots stay, and the band names the station.
- **Options (`.k-opt`, `.k-num`, `.k-tag`)**: white enamel panels with a 2 px
  ink border and square corners. A selected option inverts to ink on white,
  and its marker fills with the line colour and a check (a square marker for
  checkboxes, a round one for radios). The number tiles for days and minutes
  gain a line-colour sill when selected. Pictogram tiles are white glyphs on
  black squares, from the product's own mask set.
- **Go button (`.k-go`)**: the black direction sign, with the action on the
  left and a line-colour arrow block on the right. The arrow is an authored SVG
  that nudges on hover. The outline variant is the second landing action. A
  disabled button becomes a flat panel with a hairline, never an opacity fade.
- **Platform (`.k-platform`)**: the pinned action region. Its top edge is a
  dotted safety-yellow tactile strip, like the edge of a real platform.
- **Line map (`.k-net`)**: the origin rail on the left ("Você está aqui") and
  the terminal rail on the right. It descends into "Seu programa" and then
  "Hoje". Each line is a white row with its roundel, its name, the station
  count on a black tag, what you do, and the coloured track with one dot per
  station. The landing uses a compact rendering in which each track runs
  beside its line name.
- **Terminal review**: the program name is the station band. Facts sit in
  bordered tags. The week is drawn as a vertical line in the line colour: each
  training day is a station, and each exercise is a tick on the line beside
  its prescription. The answer tags open inline editors, and the change
  statement is a panel with a line-colour sill.
- **Transfer (`.k-transfer`)**: a Baldeação panel on the shared stations.
  It moves between Linha 1 and Linha 2 and keeps the seven shared answers. It
  states how many stations are left, and afterwards a band in the new line
  colour confirms how many answers came across. The import door uses the same
  panel to switch between paste and file, or to go to Linha 4.
- **Import rows**: the imported name, an arrow, and the library name, with a
  badge that is black (confirmed or found) or safety yellow (likely or no
  match). Each badge also carries an icon and a word. A departure-board row
  counts linked, to-review and custom rows.
- **Alerts and dialogs**: a panel with a diagonal hazard band (yellow and ink)
  and an alert pictogram. Dialogs have a black title band over a safety-yellow
  edge, with stacked actions.

## Motion

There is one authored moment, the train:

- Boarding a line (a new route) draws the track from the left with
  `clip-path` and pops the stations in sequence, 70 ms apart.
- Each Continue grows the passed rule from the previous station to the new one
  with `transform: scaleX`, over 0.6 s on an exponential ease-out, and the
  new "here" dot arrives with a halo pulse.
- Hover states nudge the arrows and dots. There are no page-entrance effects.
- Reduced motion is one decision: the harness's `data-motion="reduced"` (and
  the OS query) sets every duration to 0, and the script skips the boarding
  and arrival classes altogether. Everything is visible by default.

## Dark rendition

Dark is the night platform. The ground is charcoal, the panels are graphite,
and the station band flips to a light, backlit sign with dark type. The line
colours brighten and switch to dark ink so they hold contrast. The mark sits
on the light sign as a plate, as the brand guide asks for dark grounds.
Selected options invert to light ink panels.
