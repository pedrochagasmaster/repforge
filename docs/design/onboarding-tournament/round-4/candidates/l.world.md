# L · Pino: the world

The selectorized weight stack every Brazilian commercial gym has on its
machines: flat black powder-coated plates, a steel selector rod running
through their pin holes, stencilled numbers, a pin you pull and push into
the plate you want. Nothing is rendered as a 3D object: no grain, bevels or
gradients. The machine reads through geometry alone. One colour, safety
yellow, marks what the lifter chose; the yellow/black hazard stripe marks
what is not theirs yet.

## Palette (roles, contrast)

Tokens live on `:root` in `l.css` and swap under `[data-theme="dark"]`.

| Token | Light | Dark | Role |
|---|---|---|---|
| `--l-ground` | #E2E4DF zinc primer | #0D0E0F powder coat | page ground (the wall / the machine) |
| `--l-ground-2` | #D3D6D0 | #1B1D1F | rules, stack recess, quiet button edge |
| `--l-panel` | #EEF0EB | #16181A | placards, disclosures, pulled editor |
| `--l-ink` / `-2` / `-3` | #121311 / #40433E / #555953 | #ECEBE4 / #B9BCB4 / #A2A59D | text on ground |
| `--l-coat` / `-hi` / `-lo` | #18191B / #26282B / #0C0D0E | #1F2124 / #2C2F33 / #101112 | plates, readout, dialogs |
| `--l-stencil` / `-2` | #F1F0E8 / #B7BAB3 | same | text on plates |
| `--l-yellow` | #FFCF00 | same | the pin, primary action, "not yours yet" tag, focus ring |
| `--l-steel` | #A3A7A0 | same | selector rod, steel pin, dialog top edge |
| `--l-hole` | #070808 | same | pin holes (the rod shows through them in `--l-steel-2`) |
| `--l-danger` | #A8241A | #FF8C7C | destructive actions and conflicts |

Measured contrast: ink on ground 14.5 (light) / 16.2 (dark); ink-2 7.8 /
10.0; ink-3 5.6 on ground, 6.2 / 7.1 on panel; stencil on coat 15.4;
stencil-2 on coat 9.0 (8.2 dark coat); yellow on coat 11.9; ink on yellow
12.6; danger 5.6 (light) / 8.6 (dark), 7.8 on coat. Yellow is never text on
the light ground.

State is never colour alone: a default pin is a hollow dashed ring plus the
word "Padrão"; a chosen pin is a solid knob plus "Sua escolha" and
`aria-checked`; a locked activation carries a lock icon, diagonal hatching
and a written reason.

## Type

- **Big Shoulders Stencil Display** 800 (OFL): program names, screen titles,
  dialog titles, plate numerals, day numbers. Uppercase, capped by viewport
  width (`min(rem, vw)`) so no word breaks at 320 px or 200% text.
- **Barlow Condensed** 600/700 (OFL): placard labels, plate values, buttons,
  facts, tile keys. Uppercase with 0.05–0.1em tracking for labels.
- **Barlow** 400–700 (OFL): reading text, notes, exercise names.
- Tabular numerals throughout; sets × reps in Barlow Condensed.

## Components

- **Plate** (`.l-plate`, `.l-cplate`, `.l-bigplate`): flat coat slab, 3 px
  radius, stencilled number left, label, pin hole right. A flat steel rod
  runs behind the column of holes, shows in the gaps between plates and
  passes visibly through every empty hole.
- **Pin** (`.l-knob`): one single-stroke SVG path, a ring and its shaft. Set:
  yellow, 4-unit stroke. Default/suggestion: dashed stencil-grey ring with
  the word "Padrão" or "Sugerido". Steel: the resting pin on the landing and
  the chooser.
- **Stack** (`.l-stack`): question heading, state tag, plates, live change
  statement. Numeric stacks set numbers in stencil; days and minutes sit side
  by side at 360 px and wider.
- **Readout plate** (`.l-readout`): the program as a machine readout: stencil
  name, status tag, facts (separators clipped at line starts), collapsible
  days with Day 1 open.
- **Chooser stack** (`.l-cstack`): the three routes as numbered plates on one
  rod; the lead plate sets its title in yellow stencil.
- **Status tag** (`.l-tag`): hazard stripe + yellow field ("Ainda não é seu");
  outlined yellow ("Seu programa"); lock-open icon while a pin is pulled.
- **Pin board** (`.l-tile`): the review's answers as plates with a seated
  yellow knob; opening one pulls the pin into an inline editor (`.l-pull`).
- **Activation plate** (`.l-go`): yellow when usable; coat with yellow
  hatching and a lock when not.
- **Placard** (`.l-placard`): numbered instruction steps inside an inked
  frame, for the paste door.
- **Import stack**: one plate stack per imported row, the pin on the
  decision.
- **Dialog** (`.l-dialog`): coat card with a 6 px steel top edge and the only
  floating shadow.
- **Hazard stripe**: reserved for "not yours yet" (the status tag, the
  default-state tag) and lockouts (locked activation and commit).
- **Toggles, fields, results**: coat toggles with a yellow check box;
  recessed fields on the panel with a yellow focus outline.

## Motion

One authored moment, the pin drop: the knob FLIPs to the tapped plate over
360 ms (`cubic-bezier(.2,.9,.25,1)`), changed facts flash yellow for 1.1 s,
and on the last pin the tag wipes in and the board tiles seat with a 45 ms
stagger. Everything else is 120–200 ms press feedback. Reduced motion
(`data-motion="reduced"` or the media query) removes every animation and
transition, and the FLIP is skipped in script.

## Dark rendition

Dark is the machine itself: the ground becomes powder coat, plates turn
graphite with a flat 1 px edge so they separate from the ground, the stack recess
turns near-black. Yellow, steel and the stencil whites do not change; they
are the object's materials, not the theme's.

## Brand fit

No bull, forge or Latin; no celebration. The word "pino" is never used in
copy (brand: no metaphor labels); the machine lives in the visuals. The
landing keeps the owner's proof capture, framed as a plate.
