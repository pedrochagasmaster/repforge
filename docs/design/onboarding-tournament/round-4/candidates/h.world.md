# H · Concreto — the visual world

The world of the 1950s São Paulo concretists (Noigandres: Augusto and Haroldo
de Campos, Décio Pignatari) and the Ruptura painters: a page is a composition,
not a form. Words are set large, lowercase, on a strict grid; black and white
carry the structure and one saturated field carries the meaning. In H that
field means one thing only: **what the lifter decides** (a chosen answer, the
forward action, the new word in the verse).

Scope: this file documents the candidate world for the Round 4 harness. It is
not the app's `DESIGN.md` and changes nothing in production.

## Palette (roles, tokens, contrast)

| Token | Light | Dark | Role | Contrast |
|---|---|---|---|---|
| `--h-paper` | `#FFFFFF` | `#0B0B0B` | the page | — |
| `--h-ink` | `#0B0B0B` | `#F3F3EF` | type, rules, borders | 19.7:1 / 17.7:1 on paper |
| `--h-ink-2` | `#595959` | `#A6A6A2` | secondary text, unchosen answers, disabled | 7.0:1 / 8.1:1 on paper |
| `--h-field` | `#E0251A` | `#E0251A` | the one saturated field: choices, forward action, the verse's new word, day numerals | white on field 4.72:1; field on white 4.72:1; field on black 4.17:1 (large numerals only) |
| `--h-on-field` | `#FFFFFF` | `#FFFFFF` | type on the field | 4.72:1 |
| `--h-hair` | `#CFCFCB` | `#3B3B39` | thin separators between exercises (decorative, never the only boundary) | — |
| `--h-slab` / `--h-on-slab` | ink / paper | ink / paper | dialogs: the page inverted | 19.7:1 / 17.7:1 |

Colour is never the only signal: a chosen answer also gets a drawn tick
(words), a tick square (staircase) or a solid square glyph plus heavier weight
(chips), `aria-checked`, and the unchosen answers step back to `--h-ink-2`.
The disabled action is a dashed outline with its visible reason above it, not
a faded fill. The shared tokens (`--bg`, `--ink`, `--accent`, radii, shadows)
are re-pointed so the shared Today screen and the Privacy stub join the world.

## Type

One face: **Jost** (open Futura lineage, OFL, self-hosted in
`round-4/fonts/jost/`, weights 300–800). Futura was the concretists' face; Jost
gives its geometry without a licence problem. No second face.

- **Monumental word** (`.h-mono`, program name, door verbs, landing key word):
  700–800, lowercase, tracking −0.035 to −0.04 em, line-height 0.8–0.86. Its
  size is *measured*, not declared: `fitAll()` sets it so the longest word fills
  the grid width (capped per element and by viewport height). Words therefore
  never break or overflow at 320 px or at 200% text.
- **Question sentence**: 500, 1.375 rem, 24 ch measure.
- **Answer words**: 600, 1.3125 rem on ruled lines.
- **Numerals**: 700, tabular, sized to their staircase cell with container units.
- **Body**: 400, 1.0625 rem / 1.45; notes 0.9375 rem in `--h-ink-2`.
- Sentence case for every sentence and label; lowercase only for display words.

## Grid and material

Six columns, 16 px side gutter, 8 px column gap, 560 px maximum column. Square
corners everywhere, no shadows, no cards. Structure is drawn with rules: 3 px
under bars and above answer lists, 6 px above the poster's days, 1 px between
lines, 10 px vermilion edge on every dialog.

## Components

- **Top bar**: drawn back arrow, centre position or context ("4 de 8"), Cancel
  as an underlined word. At 200% the context moves to its own row.
- **The verse** (signature): the lifter's answers as short words separated by
  vermilion slashes, above each composition; the word just chosen is set in the
  field. On the review it becomes the colophon, one editable line per group.
- **Placed words** (`.h-word`): phrase answers set on a 3 px rule at their own
  grid position per screen (stagger, climb, 2 × 2 field, lead word over a
  2 × 2), secondary notes beneath; the chosen one flooded. Ruled full-width
  lines (`.h-opt`) remain only for short lists (priorities, structure, rest's
  "let Taurifer choose").
- **Staircase** (`.h-stair`): numeric scales (days 2–6, minutes 30–90+, rest)
  climb one grid column per step, left to right: a progression drawn as a
  progression. In large-text mode (measured, `html.h-large`) it re-sets as a
  two-column grid.
- **Chips** (`.h-chip`): loose words for muscles, movements, equipment.
- **Buttons**: words on a vermilion bar (forward), black bar (secondary
  forward), black outline (alternative), underlined word (quiet); drawn SVG
  arrow, square caps, one stroke weight.
- **Chooser doors**: six verbs (recomendar, personalizar, explorar, colar,
  importar, montar) set at one measured size in three stanzas; the lead door
  (recommend) is the vermilion field bled to the edges.
- **Poster** (review): program name monumental, facts line with vermilion
  square separators, days as columns headed by huge vermilion numerals; the
  column count is measured so no word breaks (3 at 390 px for Rafael, 2 × 2 for
  four days, one column at 200%).
- **Dialogs**: the confirmations are black slabs (page inverted) rising from
  the bottom with a vermilion top edge; the answer editor is a full-height
  sheet whose body scrolls and whose apply action is pinned.
- **Pinned action** (`.h-dock`): one per screen, 3 px rule above, reason line
  when blocked.

## Motion

One authored moment: **the flood**. A chosen answer's field wipes in left to
right (background-size, 0.5 s, exponential ease-out) while its type turns
white; the same wipe sets the new word into the verse 80 ms later. Dialogs rise
32 px from their resting place (0.36 s); the scrim fades. Hover moves arrows
4 px and steps an answer line in, only where a fine pointer can hover
(`@media (hover: hover) and (pointer: fine)`). Reduced motion (`data-motion="reduced"` or
the media query) removes every animation and transition: the states simply
appear.

## Dark rendition

The same composition on black: ink becomes warm white, the field stays the
same vermilion (white type on it keeps 4.72:1), hairlines darken, dialogs invert
to warm-white slabs with black type, the brand mark is inverted, and the landing
proof uses the dark Today capture.
