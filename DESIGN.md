---
name: Taurifer
description: One warm-paper training ledger across the landing, onboarding and the main app, in ink, tabular figures and one orange mark.
# Every value below records a live styles.css token. The comment names it, and
# tools/check-design-md.mjs fails the build when the two disagree.
colors:
  paper: "#F4F2EF"                       # token: --bg
  card-stock: "#FFFFFF"                  # token: --surface
  well: "#FAF8F5"                        # token: --well
  ink: "#1B1A17"                         # token: --ink
  ink-soft: "#6A665F"                    # token: --ink-soft
  ink-faint: "#716D66"                   # token: --ink-faint
  hairline: "#E4E1DA"                    # token: --rule
  hairline-strong: "#D9D5CD"             # token: --rule-strong
  forge-orange: "#E04E14"                # token: --accent
  forge-orange-deep: "#B8410E"           # token: --accent-deep
  accent-ink: "#FFFFFF"                  # token: --accent-ink
  cta-black: "#161513"                   # token: --cta
  cta-ink: "#FFFFFF"                     # token: --cta-ink
  positive: "#2F7D33"                    # token: --positive
  danger: "#C93A2B"                      # token: --danger
  scrim: "rgba(27,26,23,.42)"            # token: --scrim
  quiet-selected: "#1B1A17"              # token: --boundary-selected-quiet
  rule-on-surface: "#E4E1DA"             # token: --rule-on-surface
  shelf-field: "#FAF8F5"                 # token: --shelf-field-bg
  shelf-pad: "#F4F2EF"                   # token: --shelf-pad-bg
  dock-glass: "rgba(250,248,245,.8)"     # token: --dock-glass
  dock-lens: "rgba(255,255,255,.82)"     # token: --dock-pill
  band-night: "#141310"                  # token: --band-night-bg
  band-night-raised: "#1E1C18"           # token: --band-night-raised
  band-night-ink: "#F2EFE9"              # token: --band-night-ink
  band-night-ink-soft: "#ADA79D"         # token: --band-night-ink-soft
  band-night-ink-faint: "#99938A"        # token: --band-night-ink-faint
  band-night-rule: "#2E2B26"             # token: --band-night-rule
  band-night-accent: "#F2703B"           # token: --band-night-accent
  band-night-accent-text: "#FF8A3D"      # token: --band-night-accent-text
  band-night-boundary: "#ADA79D"         # token: --band-night-boundary-required
  band-night-cta: "#DED7CC"              # token: --band-night-cta-bg
  band-night-cta-ink: "#161513"          # token: --band-night-cta-ink
  band-orange: "#E04E14"                 # token: --band-orange-bg
  band-orange-ink: "#141310"             # token: --band-orange-ink
  band-orange-cta-ink: "#F4F2EF"         # token: --band-orange-cta-ink
  band-orange-cta-mark: "#F2703B"        # token: --band-orange-cta-mark
  band-ink: "#1B1A17"                    # token: --band-ink-bg
  band-ink-ink: "#F4F2EF"                # token: --band-ink-ink
  band-ink-ink-soft: "rgba(244,242,239,.78)"  # token: --band-ink-ink-soft
  band-ink-rule: "rgba(244,242,239,.22)" # token: --band-ink-rule
colors-dark:
  paper: "#141310"                       # token: --bg
  card-stock: "#1E1C18"                  # token: --surface
  well: "#191713"                        # token: --well
  ink: "#F2EFE9"                         # token: --ink
  ink-soft: "#ADA79D"                    # token: --ink-soft
  ink-faint: "#99938A"                   # token: --ink-faint
  hairline: "#2E2B26"                    # token: --rule
  hairline-strong: "#4A453D"             # token: --rule-strong
  forge-orange: "#F2703B"                # token: --accent
  forge-orange-deep: "#FF8A3D"           # token: --accent-deep
  accent-ink: "#231A14"                  # token: --accent-ink
  cta-black: "#DED7CC"                   # token: --cta
  cta-ink: "#161513"                     # token: --cta-ink
  positive: "#63C267"                    # token: --positive
  danger: "#FF6670"                      # token: --danger
  scrim: "rgba(0,0,0,.62)"               # token: --scrim
  quiet-selected: "#F2EFE9"              # token: --boundary-selected-quiet
  rule-on-surface: "#4A453D"             # token: --rule-on-surface
  shelf-field: "#191713"                 # token: --shelf-field-bg
  shelf-pad: "#141310"                   # token: --shelf-pad-bg
  dock-glass: "rgba(30,28,24,.92)"       # token: --dock-glass
  dock-lens: "rgba(255,255,255,.07)"     # token: --dock-pill
  band-night: "#141310"                  # token: --band-night-bg
  band-night-raised: "#1E1C18"           # token: --band-night-raised
  band-night-ink: "#F2EFE9"              # token: --band-night-ink
  band-night-ink-soft: "#ADA79D"         # token: --band-night-ink-soft
  band-night-ink-faint: "#99938A"        # token: --band-night-ink-faint
  band-night-rule: "#2E2B26"             # token: --band-night-rule
  band-night-accent: "#F2703B"           # token: --band-night-accent
  band-night-accent-text: "#FF8A3D"      # token: --band-night-accent-text
  band-night-boundary: "#ADA79D"         # token: --band-night-boundary-required
  band-night-cta: "#DED7CC"              # token: --band-night-cta-bg
  band-night-cta-ink: "#161513"          # token: --band-night-cta-ink
  band-orange: "#F2703B"                 # token: --band-orange-bg
  band-orange-ink: "#141310"             # token: --band-orange-ink
  band-orange-cta-ink: "#F4F2EF"         # token: --band-orange-cta-ink
  band-orange-cta-mark: "#F2703B"        # token: --band-orange-cta-mark
  band-ink: "#F2EFE9"                    # token: --band-ink-bg
  band-ink-ink: "#141310"                # token: --band-ink-ink
  band-ink-ink-soft: "rgba(20,19,16,.78)"  # token: --band-ink-ink-soft
  band-ink-rule: "rgba(20,19,16,.22)"    # token: --band-ink-rule
typography:
  label:
    fontFamily: "Plex Sans, system-ui, -apple-system, Segoe UI, sans-serif"  # token: --font-language
    fontSize: "0.6875rem"                # token: --font-size-label
  caption:
    fontFamily: "Plex Sans, system-ui, -apple-system, Segoe UI, sans-serif"  # token: --font-language
    fontSize: "0.75rem"                  # token: --font-size-caption
  body-small:
    fontFamily: "Plex Sans, system-ui, -apple-system, Segoe UI, sans-serif"  # token: --font-language
    fontSize: "0.875rem"                 # token: --font-size-body-small
  body:
    fontFamily: "Plex Sans, system-ui, -apple-system, Segoe UI, sans-serif"  # token: --font-language
    fontSize: "1rem"                     # token: --font-size-body
  control:
    fontFamily: "Plex Sans, system-ui, -apple-system, Segoe UI, sans-serif"  # token: --font-language
    fontSize: "1rem"                     # token: --font-size-control
  subtitle:
    fontFamily: "Plex Sans, system-ui, -apple-system, Segoe UI, sans-serif"  # token: --font-language
    fontSize: "1.125rem"                 # token: --font-size-subtitle
  metric:
    fontFamily: "Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace"  # token: --font-training-data
    fontSize: "1.375rem"                 # token: --font-size-metric
  section-title:
    fontFamily: "Plex Sans, system-ui, -apple-system, Segoe UI, sans-serif"  # token: --font-language
    fontSize: "1.5rem"                   # token: --font-size-section-title
  feature-title:
    fontFamily: "Plex Sans, system-ui, -apple-system, Segoe UI, sans-serif"  # token: --font-language
    fontSize: "1.75rem"                  # token: --font-size-feature-title
  focal-data:
    fontFamily: "Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace"  # token: --font-training-data
    fontSize: "1.75rem"                  # token: --font-size-focal-data
  title:
    fontFamily: "Plex Sans, system-ui, -apple-system, Segoe UI, sans-serif"  # token: --font-language
    fontSize: "1.875rem"                 # token: --font-size-title
  display:
    fontFamily: "Plex Sans, system-ui, -apple-system, Segoe UI, sans-serif"  # token: --font-language
    fontSize: "2.5rem"                   # token: --font-size-display
  landing-headline:
    fontFamily: "Plex Sans, system-ui, -apple-system, Segoe UI, sans-serif"  # token: --font-language
    fontSize: "2.375rem"                 # token: --font-size-landing-headline
  landing-headline-wide:
    fontFamily: "Plex Sans, system-ui, -apple-system, Segoe UI, sans-serif"  # token: --font-language
    fontSize: "3.25rem"                  # token: --font-size-landing-headline-wide
  rest-clock:
    fontFamily: "Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace"  # token: --font-training-data
    fontSize: "clamp(2rem, 10cqi, 2.625rem)"  # token: --font-size-rest-clock
weight:
  regular: 400                           # token: --weight-regular
  medium: 500                            # token: --weight-medium
  semibold: 600                          # token: --weight-semibold
leading:
  tight: 1.1                             # token: --line-tight
  standard: 1.4                          # token: --line-standard
  reading: 1.55                          # token: --line-reading
rounded:
  none: "0"                              # token: --radius-none
  compact: "4px"                         # token: --radius-compact
  control: "8px"                         # token: --radius-control
  surface: "12px"                        # token: --radius-surface
  prominent: "16px"                      # token: --radius-prominent
  landing-stage: "24px"                  # token: --radius-landing-stage
  landing-stage-compact: "20px"          # token: --radius-landing-stage-compact
  landing-crop: "14px"                   # token: --radius-landing-crop
  pill: "999px"                          # token: --radius-pill
  round: "50%"                           # token: --radius-round
spacing:
  xs: "4px"                              # token: --space-4
  sm: "8px"                              # token: --space-8
  md: "12px"                             # token: --space-12
  card: "14px"                           # token: --space-14
  gutter: "16px"                         # token: --gut
  section: "18px"                        # token: --space-18
  band: "26px"                           # token: --space-26
  run: "32px"                            # token: --space-32
elevation:
  flat: "none"                           # token: --elevation-flat-shadow
  selected: "inset 0 0 0 2px #B8410E"    # token: --elevation-selected-shadow
  selected-quiet: "inset 0 0 0 2px #1B1A17"  # token: --elevation-selected-quiet-shadow
  floating: "0 8px 24px rgba(27,26,23,.18)"  # token: --elevation-floating-shadow
  persistent: "0 -4px 16px rgba(27,26,23,.09)"  # token: --elevation-persistent-shadow
  sheet: "0 -8px 40px rgba(27,26,23,.18)"  # token: --elevation-sheet-shadow
  dialog: "0 16px 40px rgba(27,26,23,.12)"  # token: --elevation-dialog-shadow
  nav: "inset 0 1px 0 rgba(255,255,255,.7), inset 0 -1px 0 rgba(27,26,23,.05), 0 10px 30px rgba(27,26,23,.13), 0 2px 8px rgba(27,26,23,.07)"  # token: --elevation-nav-shadow
  focus-halo: "0 0 0 3px rgba(224,78,20,.12)"  # token: --control-focus-halo-shadow
components:
  touch-target:
    size: "44px"                         # token: --control-target
  button-primary:
    backgroundColor: "{colors.cta-black}"
    textColor: "{colors.cta-ink}"
    rounded: "{rounded.control}"
    typography: "{typography.control}"
  button-secondary:
    backgroundColor: "{colors.card-stock}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    typography: "{typography.control}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    typography: "{typography.body-small}"
  dock:
    backgroundColor: "{colors.dock-glass}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.pill}"
    typography: "{typography.label}"
  dock-lens:
    backgroundColor: "{colors.dock-lens}"
    rounded: "{rounded.pill}"
  sheetband:
    backgroundColor: "{colors.card-stock}"
    textColor: "{colors.ink}"
    typography: "{typography.section-title}"
  ledgerline:
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    typography: "{typography.body}"
  ledgerline-open:
    backgroundColor: "{colors.well}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
  rxrow:
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    typography: "{typography.body}"
  workshelf:
    backgroundColor: "{colors.card-stock}"
    textColor: "{colors.ink}"
    rounded: "{rounded.prominent}"
  shelf-field:
    backgroundColor: "{colors.shelf-field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    typography: "{typography.metric}"
  shelf-pad:
    backgroundColor: "{colors.shelf-pad}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    typography: "{typography.control}"
  tabrow-tab:
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.none}"
    typography: "{typography.control}"
    height: "44px"                       # token: --control-target
  verdictmark:
    textColor: "{colors.ink}"
    typography: "{typography.body-small}"
  freqcount-bar:
    backgroundColor: "{colors.ink}"
    rounded: "{rounded.compact}"
---

> **Implementation status:** This file records the design system as it ships:
> one system under the public landing, onboarding and the Direction D main app.
> It owns no rule of its own. Roles, tiers, radius steps, elevation layers and
> control roles belong to the [UI-system semantic contract](docs/design/ui-system-semantic-contract.md)
> and its dated Plan 064 amendments; the shared-language rules belong to
> [Plan 064 section 8](plans/064-unified-redesign-convergence.md); values belong
> to `styles.css`. Where this file and `styles.css` differ, `styles.css` wins and
> this file is the bug. Each front-matter value names its token in a `# token:`
> comment, and `node tools/check-design-md.mjs` fails when a value, a token name
> or a hex literal in the prose no longer matches the live stylesheet.

# Design System: Taurifer

## Overview

**Creative North Star: "The Training Ledger"**

Taurifer looks like a warm paper record book that happens to compute. The page
is unbleached paper (`--bg`), the type is near-black ink, and figures sit in
aligned columns because `font-variant-numeric: tabular-nums` is set on `body`,
so a column of loads never shifts under its own digits. Reading screens are flat
paper separated by hairlines; groups are never cards. One colour, a burnt
orange, is the only mark the hand makes, and it is rationed by a budget of five
named uses (see Colors).

It is one product, not three. The public landing, onboarding and the main app
share the same paper, ink, type roles, radius steps, spacing scale and controls.
The landing is a run of bands on that same system: paper bands, an ink band, and
a night and an orange band built from named surface pairs. Onboarding uses the
same roles and the quiet ink selection. The main app is Direction D (ADR 0016):
a prescription table, a logging shelf, an inline rest and a ledger summary. A
lifter who moves from the landing into a first program and then into Today
should not be able to tell where one surface ended.

The system is built for one hand, standing, at a machine, between sets: a 560px
column, a 44px floor on every interactive target, ledger rows of at least 48px,
and a floating capsule dock under the thumb. It is unhurried in a specific way.
Motion is short, goes through one layer, is removed by reduced motion without
removing information, and never congratulates. The product's personality is a
quiet training partner, and the visual system's job is to stay out of the way of
a number.

Dark is not a second design. It is the same system with the token values swapped
under `:root[data-theme="dark"]`: paper becomes `#141310`, ink becomes `#F2EFE9`,
and the orange moves to `#F2703B` to hold contrast on a dark ground. Every rule
here holds in both themes, and every new surface pair is declared for both.

**Key Characteristics:**

- Warm unbleached paper as the page, ink as the text, tabular figures wherever
  numbers are compared
- Hairline rules and whitespace instead of cards and shadows for ordinary content
- One orange mark, spent only inside the five-use budget
- Records are green, declines are ink, and nothing celebrates
- Plex Sans for language and controls, Plex Mono for training values chosen by
  value
- One column, capped at 560px, on the landing as much as in the app
- 44px minimum on every target, PT-BR validated first

## Colors

A warm, low-chroma neutral field with one saturated accent, plus a green that
appears only for records and a red that appears only for destruction and
validation. Light and dark values are listed together; the front matter carries
both.

### Primary

- **Forge Orange** (`--accent`, #E04E14 light / #F2703B dark): the live mark. It
  is spent only on the five uses of the budget below, as a fill, glyph or edge.
  It is never the colour of body-size text.
- **Forge Orange Deep** (`--accent-deep`, #B8410E light / #FF8A3D dark): the
  same accent when it has to be small text on paper. `--accent` measures 3.57:1
  on the light page, below the 4.5:1 text floor, so anything read at body size or
  smaller uses this token.
- **Accent Ink** (`--accent-ink`, #FFFFFF light / #231A14 dark): the ink on a
  filled `--accent-deep` ground. It is not `--cta-ink`: in dark the CTA inverts to
  a light pill while the orange stays orange, so the two inks move in opposite
  directions.

### The orange budget

Plan 064 section 8.8 allows the accent in exactly five places, and
`ORANGE_ALLOWLIST` in `tools/check-direction-d.mjs` binds each to a selector. The
rules-only gate (`tools/check-rules-only.mjs`) reads the same list and adds
nothing to it.

1. **Verdict glyphs.** The up glyph of `.verdictmark` is the only orange glyph.
   Hold ("=") and recover ("↻") are ink, the down arrow is ink, and a record is
   green. Orange on a verdict means the engine asked for more.
2. **The current-exercise segment.** The current segment of the Focus exercise
   bar (`#woProgress .segbar__seg.is-current`). Done segments are ink.
3. **A running timer's drain bar.** `.restinline__fill`, a `scaleX` transform on
   a 4px track while a rest runs. It stops being orange the moment the rest ends.
4. **The CTA arrow.** The drawn arrow mask at the right edge of `.btn--cta`,
   which stays `--accent` on the CTA ground in both themes.
5. **The active dock item.** The shipped active item's icon, label and selection
   edge (owner build decision on #295, 2026-10-01), travelling with the lens.

Two further paints are real and are not budget uses. The focused control's
indicator is painted from `--color-focus`, the contract's focus-visible role, and
the audit lists it separately. Onboarding's change statement keeps its accent
rail and the "new" tag on an added row (Plan 064 I-06, Q637). The landing's
orange band is a ground, not a mark, and is described under Landing bands.

### Neutral

- **Warm Paper** (`--bg`, #F4F2EF light / #141310 dark): the page. Never pure
  white.
- **Card Stock** (`--surface`, #FFFFFF light / #1E1C18 dark): the ground of
  sheets, dialogs, the shelf shell, inputs and secondary buttons.
- **Well** (`--well`, #FAF8F5 light / #191713 dark): a recessed ground inside a
  surface: hover and pressed grounds, the open ledger row, shelf fields, the FAQ
  band.
- **Ink** (`--ink`, #1B1A17 light / #F2EFE9 dark): primary text, iconography, and
  the quiet selected boundary.
- **Soft Ink** (`--ink-soft`, #6A665F light / #ADA79D dark): secondary text, the
  previous-set line, inactive tab labels. Prefer its role alias
  `--color-ink-secondary` in rules.
- **Faint Ink** (`--ink-faint`, #716D66 light / #99938A dark): the quietest ink
  step, used by the older eyebrow and label rules. Soft Ink has the higher contrast
  of the two in both themes.
- **Hairline** (`--rule`, #E4E1DA light / #2E2B26 dark): the default 1px
  decorative boundary. It is never the sole cue for a control.
- **Hairline Strong** (`--rule-strong`, #D9D5CD light / #4A453D dark): the line on
  a white surface, the floating and modal edge. It measures 1.31:1 on the light
  page, so it never carries a required mark.
- **Rule on Surface** (`--rule-on-surface`, `--rule` in light and `--rule-strong`
  in dark): the decorative separator drawn on `--surface`, inside sheets and the
  shelf.
- **CTA Black** (`--cta`, #161513 light / #DED7CC dark): the single primary
  action. It inverts between themes while the orange does not.
- **Quiet Selected** (`--boundary-selected-quiet`, an alias of `--ink`): the
  selected boundary wherever the orange is rationed.

### Semantic

- **Positive** (`--positive`, #2F7D33 light / #63C267 dark; role
  `--color-improved`): a record or an improved result. Never decorative.
- **Danger** (`--danger`, #C93A2B light / #FF6670 dark; role
  `--color-destructive`): destructive actions and validation failures. A decline
  is not red: the declined outcome and the down arrow are ink.
- **Maintained** (`--color-maintained`, an alias of `--ink-soft`): the word for a
  maintained session outcome.

### Landing bands

The landing's grounds are named surface pairs, each declared in both themes
(Plan 064 OG-3). The night band is the dark palette in both themes, so it does not
flip with Appearance.

| Band | Ground and ink tokens | Used for |
| --- | --- | --- |
| Night | `--band-night-bg`, `--band-night-ink`, `--band-night-ink-soft`, `--band-night-ink-faint`, `--band-night-rule` | The hero and the footer |
| Night, raised | `--band-night-raised` over the same inks | The proof band |
| Orange | `--band-orange-bg` (the live accent as the field), `--band-orange-ink` | The closing band |
| Ink | `--band-ink-bg` (the live ink as the field), `--band-ink-ink`, `--band-ink-ink-soft`, `--band-ink-rule` | The data band |
| Paper | `--bg`, and `--well` for the FAQ | The ways and track bands |

On the night band the current rail step and the proof result use
`--band-night-accent` and `--band-night-accent-text`, and the marks that were
`#4A453D` (1.79:1 and 1.95:1) are `--band-night-boundary-required`. The landing's
primary actions are ink pills: `--band-night-cta-bg` with `--band-night-cta-ink`
on the night band, and `--band-orange-ink` with `--band-orange-cta-ink` and the
`--band-orange-cta-mark` arrow on the orange band. The night pill draws its arrow
in its own ink because orange on the parchment pill measures 2.05:1.

### Named Rules

**The One Mark Rule.** The orange marks one of five things and nothing else. If a
screen has a sixth orange element, the screen is wrong, not the budget. Its
scarcity is what makes the active dock item findable.

**The Records Are Green Rule.** A record uses `--positive`; a decline uses ink; an
up verdict uses the single orange glyph. The word is never the accent.

**The Two-Ink Accent Rule.** Orange as a mark and orange as text are different
tokens. Small accent text uses `--accent-deep`; a fill on `--accent-deep` carries
`--accent-ink`; a fill, ring, glyph or edge uses `--accent`. Never substitute one
for the other to keep things consistent.

**The Warm Paper Rule.** The page ground is never pure white and the ink is never
pure black. A surface that reads cold against its neighbours has picked the
wrong token.

**The Channel Triplet Rule.** A translucent use of a theme colour reads its
`--*-rgb` triplet (`rgba(var(--accent-rgb), .12)`), never a hardcoded rgba, so a
theme swap carries washes and focus rings with it.

## Typography

**Language and controls:** Plex Sans (self-hosted woff2, variable weight 100 to
700), falling back to `system-ui, -apple-system, Segoe UI, sans-serif`
(`--font-language`).
**Training data:** Plex Mono at 400, 500 and 600, falling back to
`ui-monospace, SFMono-Regular, Menlo, monospace` (`--font-training-data`).

**Character:** Plex is a humanist grotesque with slightly mechanical joints:
engineered rather than friendly, legible at 11px, and plain at large sizes in a
way that suits a product that does not want to perform. The two families are one
voice in two registers. The contract's rule is to choose by value, not ancestry:
Mono for loads, reps, RIR, time, counts and visible technical IDs; Sans for
everything that is language.

### Hierarchy

The tier scale is Plan 058's, and Plan 064 adds no size. Pixel values are at the
default 16px root.

- **Label** (`--font-size-label`, 11px): column heads and eyebrows, set uppercase
  at .08em on structural labels. Never the sole critical control text.
- **Caption** (`--font-size-caption`, 12px): supporting notes, frequency counts.
- **Body small** (`--font-size-body-small`, 14px): secondary lines, the
  previous-set line, the verdict mark's word.
- **Body and control** (`--font-size-body`, `--font-size-control`, 16px): prose,
  rows and controls. 16px is also the floor for any input a thumb will focus,
  because iOS zooms the viewport below it.
- **Subtitle** (`--font-size-subtitle`, 18px, semibold): the in-flow section head
  (Today's prescription title, the summary's section heads, History's block and
  frequency heads, a program day), the Focus exercise name, the next-set cue's
  second line, and the Why headline. This is the OG-4 section-head decision: a
  head that sits inside a page is `subtitle`, not `section-title`.
- **Metric** (`--font-size-metric`, 22px, Mono): a prominent numeric value, such as
  the Today load figure, the summary totals and the shelf field values.
- **Section title** (`--font-size-section-title`, 24px, semibold): names a sheet
  or a page section. It is the `.sheetband` title and the Focus cue line.
- **Feature title** (`--font-size-feature-title`, 28px): names a program, result
  or editorial beat. Under OG-4 it no longer names the focal exercise.
- **Focal data** (`--font-size-focal-data`, 28px, Mono): the Mono value that
  anchors the current task. It shares the 28px step with feature title and keeps a
  different job and family.
- **Title** (`--font-size-title`, 30px, semibold): page titles, and the saved
  session's hero line.
- **Display** (`--font-size-display`, 40px): full display statements.

Three contextual variants sit above or beside the ladder, and each is selector
exact in `tools/ui-role-inventory.json`: the landing headline
(`--font-size-landing-headline`, 38px, and `--font-size-landing-headline-wide`,
52px from 700px wide, falling back to `--font-size-title` at 340px and below;
weight 500), and the responsive Mono rest clock (`--font-size-rest-clock`,
`clamp(2rem, 10cqi, 2.625rem)`, on `.restinline__clock` alone).

Weights are 400, 500 and 600 (`--weight-regular`, `--weight-medium`,
`--weight-semibold`) and line heights are tight 1.1, standard 1.4 and reading 1.55
(`--line-tight`, `--line-standard`, `--line-reading`). Tracking has no token: it is
set per rule, .08em on uppercase labels and -.02em on the larger title rules.

### Named Rules

**The Tabular Figures Rule.** `font-variant-numeric: tabular-nums` is set on
`body` and is not turned off on a surface that shows a series of measurements. A
column of loads that reflows as digits change is a bug.

**The Role Not Size Rule.** A new size is not added because a legacy literal falls
between tiers. Map the content job to a role; a genuinely new job goes through a
contract review, not a slice.

**The Uppercase Label Rule.** Uppercase is the presentation of short structural
labels, not of copy: strings stay in sentence case (brand guide), and a sentence,
a heading or a control label is never forced to capitals.

**The 16px Input Floor Rule.** A focusable input is at least `--font-size-control`.
Below that the browser zooms the page and the lifter loses their place in the set.

## Layout

One column, centred, capped at `--maxw` (560px), with a `--gut` (16px) gutter that
widens to the safe-area inset on notched devices. The landing keeps the same
column; its wide breakpoint enlarges the headline and the margin, not the layout.
Phone widths of 320, 360, 390 and 430 are the target, with no horizontal page
scroll, and Portuguese at 360 is checked first because it is usually the longer
language. Names wrap and are never ellipsized.

Vertical rhythm runs on the named scale in the front matter: 4, 8, 12, 14, 16, 18,
26 and 32 (`--space-4` to `--space-32`, with `--gut` for the gutter). Reading
screens separate groups with a hairline and whitespace. Ledger rows are at least
48px and two-line rows 56px, with one hairline per break. The scale is a naming
convention that new rules use; the contract defines no spacing role and
the strict CSS check does not scan it.

The bottom of every scrolling view reserves `--nav`, which is `--dock-h` plus
`--dock-gap`, plus the safe-area inset, so persistent chrome never covers the last
row. Every floating element (rest bar, toast, tour) measures itself against `--nav`
rather than inventing an offset. At 200% text the dock takes two rows and `--nav`
grows with it.

### Named Rules

**The Single Column Rule.** There is one content column and it is 560px wide. Do
not introduce a sidebar, a two-up grid of cards or a desktop layout. Wider
viewports get more margin, not more columns.

**The Dock Reservation Rule.** Anything fixed to the bottom of the screen
positions itself from `--nav`. A hardcoded bottom offset collides with persistent
chrome on some device.

## Elevation & Depth

**Flat paper, five layers.** The contract names five layers, and a rule uses one
of them or none.

| Layer | Meaning | Boundary and depth | Owners |
| --- | --- | --- | --- |
| `flat` | Ordinary reading, data and grouping | Whitespace or a decorative hairline; no shadow (`--elevation-flat-shadow`) | Every reading screen, ledger, History, Program rows |
| `selected` | A chosen option or active destination | An inset 2px ring, no outward shadow | Choices, tabs, the open ledger row, shelf fields, the dock's active item |
| `floating` | A temporary local tool | Theme-aware outward shadow and a boundary | Menus, toast, the landing's sticky Build control |
| `modal` | A layer that owns attention and blocks its parent | Scrim and stronger depth | Sheets, dialogs, the first-run gate, the summary |
| `persistent-action` | Actions kept reachable while content scrolls | Shallow edge and depth | The dock, the workout shelf, the Program edit dock, the summary Done bar |

The selected ring has two recipes. `--elevation-selected-shadow` is the accent-deep
ring. Where the orange is rationed, `--elevation-selected-quiet-shadow` draws the
same 2px recipe in ink through `--boundary-selected-quiet`; it adds no width, and
1.5px was rejected. The quiet boundary marks shelf fields and the open ledger row
(as the ring), the chosen option in rules-only surfaces, and the tab indicator (as a
2px underline).

### Shadow Vocabulary

Shadows use a theme-specific channel (`--shadow-rgb`), so dark never casts a pale
shadow.

- **Floating** (`--elevation-floating-shadow`): a menu, the toast and the sticky
  Build control.
- **Persistent** (`--elevation-persistent-shadow`): the shelf's upward edge.
- **Sheet** (`--elevation-sheet-shadow`) and **dialog** (`--elevation-dialog-shadow`):
  a bottom sheet or a centred dialog arriving over the page.
- **Dock** (`--elevation-nav-shadow`): the capsule's two ambient shadows with an
  inset sheen and an inset bottom line. The Program edit dock is the flush variant
  (`--elevation-program-dock-shadow`) of the same role.
- **Focus halo** (`--control-focus-halo-shadow`): not elevation. A ring drawn with
  box-shadow because it must follow a border radius.

### Named Rules

**The Flat Content Rule.** A row, group, field, well or panel in the reading
column has no outward shadow. If it needs to separate, it gets a hairline, a `--well`
ground or the quiet ring, never a lift. A selected child may live inside an
elevated layer; a second outward shadow may not.

**The Floating Material Rule.** Glass and shadow are reserved for objects over the
page: the dock, the shelf, sheets and dialogs, toasts, and the landing's sticky
control. Adding another floating layer is a contract decision, not a styling one.

## Shapes

Radii are the contract's role steps, and consumers name the role for their own
geometry: none (`--radius-none`, 0), compact 4px, control 8px, surface 12px,
prominent 16px, pill 999px and round 50%.

- **Control** (8px): buttons, fields, shelf fields and pads.
- **Surface** (12px): the open ledger row, the toast, the landing's ink pill.
- **Prominent** (16px): sheets and dialogs on their top corners, and the workout
  shelf on its top corners with a square bottom.
- **Compact** (4px): the sheet handle, the drain bar, frequency bars.
- **Pill and round**: ghost buttons, the dock capsule and its lens; icon buttons and
  the sheet close.
- **Landing stage** (`--radius-landing-stage` 24px, `--radius-landing-stage-compact`
  20px at 340px and below, `--radius-landing-crop` 14px): the exact composition of
  the proof's phone plate and step crops. They are stage geometry, not reusable
  steps.

Where a surface meets the edge of its parent (a ledger row, a tab, a prescription
row) the corner is squared with `--radius-none`, so nested surfaces never read as
cards inside cards. The dock's radius is computed from its own height
(`calc(var(--dock-h) / 2)`), so it stays a true capsule if the height changes.

### Named Rules

**The No Nested Cards Rule.** A bounded surface does not contain another bounded
surface. Use a squared inner edge, a `--well` ground, a hairline or the quiet ring.

**The Role Radius Rule.** A rule names the radius role for its own geometry. The
old 14px step and its alias are gone, and no value was normalized mechanically.

## Components

Restrained and thumb-sure: hairlines and flat fills that stay out of the way, sized
for a standing, one-handed user mid-set. The inventory (`tools/ui-role-inventory.json`)
names every shared component and its role; a component block in `styles.css` without
an inventory row fails `tools/check-ui-system.mjs`.

### Buttons

- **Shape:** control radius (8px); ghost variants are pills.
- **Primary (CTA):** full width, `--cta` fill with `--cta-ink`, 54px minimum
  height, no border, and a drawn arrow mask at the right edge in `--accent` (budget
  use 4). Disabled is never opacity: the flat `--control-primary-disabled-bg` and
  `--control-primary-disabled-ink` treatment, with the reason in separate readable
  text. The light disabled label measures 4.37:1, under 4.5:1, and raising it needs
  a token value change that is recorded for the owner (RF-1).
- **Secondary:** surface fill, a required boundary, ink text.
- **Ghost:** transparent pill for a tertiary action in a row.
- **Steel:** surface with the stronger hairline, for a secondary on a white surface.
- **Landing ink pill:** a 56px `--radius-surface` pill with a trailing arrow, on the
  night or orange band as above. "Track" and the import route are underlined text
  links, and the sticky Build control is the same pill floating.
- **Press and focus:** `--control-pressed-transform` on active. Focus is the
  `--control-focus-outline` ring, never a lift.

### Sheet header band (`.sheetband`)

Every sheet wears one header: a 38 by 5 handle, a `section-title` title, an optional
`body-small` line and a 44px close reserve whose close button is centred on the first
title line. The band draws no separator. Actions sit in the sheet foot, not the head,
with the first action primary. Why, the day picker, timer presets,
the calendar, exercise actions, the Session sheet, the entry-route sheets and the
rules-only sheets all use it. A sheet never traps focus.

### Ledger line (`.ledgerline`)

Flat, read-only data on one decorative hairline per break: an index column and
right-aligned Mono values, at least 48px, or 56px when the previous-set line sits
under it. `.ledgerline--open` is the row being logged or corrected: a `--well`
ground, `--radius-surface` and the quiet 2px ring in place of its hairline. A done
row reopens for correction as a secondary action. One outline travels between rows.

### Prescription row (`.rxrow`)

Name and strategy line, verdict mark, load and target on one first baseline, with
the whole row opening the exercise (quiet-navigation, at least 48px). Columns follow
the widest load and target forms and scale with the root, so they reflow at 200%
text. A manual row leaves the mark empty so names still align and shows its sets and
range in soft ink, with no load (RF-4: the program has no authored-load field).

### Workout shelf (`.workshelf`)

The persistent-action layer under Focus: full width, `--radius-prominent` on the top
corners only, a `--boundary-persistent` top edge and `--elevation-persistent-shadow`.
Three field buttons (load, reps, RIR) sit on `--shelf-field-bg`, each exposing
`aria-pressed` with the quiet ring when selected, and the pads for the selected field
sit on `--shelf-pad-bg`. A second tap on the selected field turns it into the real
input under the draft key. Unconfirmed values show in soft ink. The primary action
commits through the one existing commit path, and when an exercise is complete the
shelf shows the completion actions in place of the fields. It replaces the dock
during a workout and never covers a recovery banner.

### Tab row (`.tabrow`)

A hairline-underlined row of selection controls, each at least 44 by 44, in the
`control` role at 500 weight (600 selected). Unselected tabs are
`--color-ink-secondary`; the selected indicator is 2px in `--boundary-selected-quiet`
and travels between tabs. The row scrolls sideways without a scrollbar. Progress is
one tab row of five.

### Verdict mark (`.verdictmark`)

A drawn glyph and a word beside a `rec.*.label`, on flat content. The glyph is
redundant, so it is `aria-hidden`; the word carries the meaning. Up is the arrow in
`--color-action` (the only accent glyph) and down is the same arrow in ink. `=`
(`.verdictmark--hold`, and `.verdictmark--maintained` for the session outcome Maintained) and
the clockwise return `↻` (`.verdictmark--recover`) are drawn masks in ink, never
typed characters. A record is a check in `--color-improved`. Stalled and new stay
word-only. One meaning has one glyph, so the maintained outcome and the hold
recommendation draw the same `=`.

### Frequency count (`.freqcount`)

Flat, non-interactive bars of sessions per week and per weekday, in ink on the page
ground, labelled as one image with the block total. The baseline is decorative; the
planned-sessions marker is a required boundary (`--boundary-required`), never
`--rule-strong`. One session counts once, with no intensity, no streak and nothing
marking a missed day. The counts are hidden when no program is active.

### The dock and its travelling lens

A floating glass capsule: `--dock-h` tall (62px at the default text size), inset
`--dock-inset` (14px) from each edge and parked `--dock-gap` (10px) above the safe
area, with four columns (Today, Progress, History, Program) and 6px padding. It is
frosted (`blur(30px) saturate(180%)`) with an inset sheen. Items are a masked icon
over an 11px label at 500 weight, in `--ink-soft` at rest. The active item takes
`--accent` on the icon and `--accent-deep` on the label and sits in one lens
(`.dock-lens`, `--dock-pill`) that travels between tabs on `layoutShift`; with the
script absent, the active button paints the same lens itself. The dock is hidden in
Focus, the Library, Preview and Import, in History's session edit and behind the
first-run gate, and the Program editor swaps in a flush edit bar.

### Inline rest

Rest is not a sheet. In Focus the cue slot (`.fx-slot`) trades the next-set cue for
the running clock: a Mono `rest-clock` figure with the rest total beside it, a 4px drain bar
(`--accent` on a `--rule` track, `.restinline__fill`, the one orange mark a running
timer may carry) and the next cue on `subtitle` with its Why link. The shelf's pad
row becomes -30s, Pause or Resume, +30s and Skip. At large text the field pads stay
while a rest runs and the rest controls live in the presets sheet. Past zero the line
reads "Rest done · +0:15" in soft ink and counts up, with no warning colour.
Logging stays enabled throughout. The timer is "Pause", never "Hold". The presets
sheet (`#restSheet`) remains for presets, -30s, +30s, restart and end.

### Why sheet

"Why this weight" is a modal sheet wearing `.sheetband`. Its headline is the verdict
mark and the load the engine asks for, on `subtitle`. Each fact is one sentence under
a bold lead on a hairline, the first sentence carrying the RIR it used; the worked
calculation sits behind a disclosure; the evidence footer and one dismiss action
close it. The in-session variant, opened from the rest cue, states the observed
capacity before the prediction, never the reverse. A manual strategy gets one
sentence and no calculation.

### Summary ledger

The saved-session summary is a full-screen modal read as a ledger, not a reward.
Eyebrow, the day and its totals, then one flat group per lift: the lift's name and
its outcome word in ink with the shared verdict mark, the performed sets in Mono, a
record line in `--color-improved` when there is one, and the next target as the
strongest line. The first session of a lift shows a neutral baseline and no outcome
words. Hard sets by muscle are ranked counts, and the week line follows. The totals
keep a count ramp, and there is no check circle and no row stagger. Done is a pinned
persistent action at the end.

### Retired

These no longer exist, and a new rule does not reintroduce them: the rest timer sheet
and its dial as the rest surface, Today's Preview action, the readiness line, Focus's
"change since last session" delta line, the Progress overview's week bar, all-time
tiles and volume block.

## Motion

Everything goes through `motion-layer.js`, which owns the single reduced-motion
decision. Reduced motion is an alternate state, not a slower animation: the end state
and the information it carries are identical, and nothing in the app depends on an
animation to say what happened. Nothing animates to celebrate, and orange is spent
only inside the budget.

**Vocabulary.** Six named settings and no spring literal at a call site:
`gestureSettle` (a released surface returning to rest), `gestureExit` (a surface
leaving because the gesture asked), `layoutShift` (rows trading places, and one
indicator travelling), `navPush` (a page pushed by a tap or carried off by a committed
back swipe), `revealIn` (200ms, content measuring itself open) and `revealOut` (150ms,
the same closing).

**Owners.** `motion-layer.js` owns springs, gestures and measured heights: sheet and
Focus-deck gestures, `animateIndicator` (the dock lens, the field outline, the open-row
outline, the tab underline, the chart marker), `animateCoordinates` (chart scope
change), `animatePush` and the edge-swipe back on pushed pages outside Focus,
`animateSlot` (the inline rest slot) and `animateDisclosure`. `app.js` mounts and
disposes the controller and decides when to call it. `motion-polish.css` owns the short
fixed beats: the 12px shelf rise (160ms), the 6px direction-aware value change (120ms),
the chart line's clip reveal, the landing's stepped reveal, the build stagger and the
persist-retry hairline. `styles.css` keeps the frequent set acknowledgement (160ms).

The training loop is the most restrained: the shelf and rest changes never delay or
disable the shelf CTA. The full record, each addition's owner and its reduced-motion
path, is [`docs/design/interaction-runtime-audit.md`](docs/design/interaction-runtime-audit.md);
the owner's amendment is [`docs/design/motion-rule-11-amendment.md`](docs/design/motion-rule-11-amendment.md).

## Do's and Don'ts

### Do:

- **Do** name tokens, never raw values. Dark is a token swap under
  `:root[data-theme="dark"]`, and the strict CSS check (`tools/check-ui-system.mjs --strict-css`) rejects a literal
  colour, size, radius or shadow in scope.
- **Do** spend the accent only inside the budget of five, and use `--accent-deep` for
  small accent text, `--accent-ink` on a filled accent and `--accent` for fills, glyphs
  and edges.
- **Do** use `--boundary-selected-quiet` for selection where the orange is rationed,
  and a required boundary (`--boundary-required`) for any non-text mark that carries
  meaning.
- **Do** keep every interactive target at 44 by 44 and every focusable input at the
  16px control size, in Portuguese and English at 360.
- **Do** give every sheet one `.sheetband` head, with the actions in the sheet foot.
- **Do** separate surfaces with a hairline, a `--well` ground or the quiet ring, and
  keep reading screens flat.
- **Do** position anything fixed to the bottom from `--nav`.
- **Do** keep native confirmations native (History's delete question is a native
  `confirm()`) until a drawing replaces them, as the discard-edits sheet was drawn.
- **Do** declare each new surface pair in both themes and check it in the rendered-role
  audit, including at 200% text.
- **Do** put every motion through `motion-layer.js` with a reduced-motion path and a
  row in the interaction audit.
- **Do** send a new role, tier, radius step, palette value or shadow through a
  versioned contract review, not a slice.

### Don't:

- **Don't** swap the orange across a surface or darken licensed art. The accent is a
  mark, not a theme, and paper-backed art stays as it is.
- **Don't** add a token outside the contract, or a size because a legacy literal falls
  between tiers.
- **Don't** put a shadow on a content surface or nest a bounded card inside another.
- **Don't** put artwork on a list row. The empty media tile stays empty.
- **Don't** use `--rule-strong` for a required mark; it measures 1.31:1 in light.
- **Don't** put `aria-pressed` or `aria-selected` on a one-shot button; the resulting
  list or group carries the state.
- **Don't** blanket-`opacity` a disabled control. A disabled control has native
  disabled semantics and its reason stays readable.
- **Don't** draw a decline in red or orange. It is ink, and only a record is green.
- **Don't** add a score, streak, badge, points total, grade or celebration: no
  celebratory commit, odometer digits, orange flash, PR celebration or breathing rest
  clock. The product records and computes; it does not congratulate.
- **Don't** add a dock destination beyond the shipped set, a second column, a sidebar
  or a desktop layout.
- **Don't** label the timer "Hold". It is "Pause".
- **Don't** ellipsize a name or judge copy length in English alone. Portuguese ships at
  full parity and is validated first.
