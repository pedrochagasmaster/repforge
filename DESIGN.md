---
name: Taurifer
description: A warm-paper training ledger for progressive overload — ink, tabular figures, and one orange mark.
colors:
  paper: "#F4F2EF"
  card-stock: "#FFFFFF"
  well: "#FAF8F5"
  ink: "#1B1A17"
  ink-soft: "#6E6A63"
  ink-faint: "#716D66"
  hairline: "#E4E1DA"
  hairline-strong: "#D9D5CD"
  forge-orange: "#E04E14"
  forge-orange-deep: "#B8410E"
  cta-black: "#161513"
  cta-ink: "#FFFFFF"
  positive: "#2F7D33"
  danger: "#C93A2B"
typography:
  display:
    fontFamily: "Plex Sans, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 650
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Plex Sans, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Plex Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Plex Sans, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.08em"
  numeric:
    fontFamily: "Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "16px"
    fontWeight: 500
rounded:
  none: "0"
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "14px"
  sheet: "20px"
  pill: "999px"
  circle: "50%"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  card: "14px"
  gutter: "16px"
  section: "18px"
  band: "26px"
  run: "32px"
components:
  button-secondary:
    backgroundColor: "{colors.card-stock}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "13px 16px"
    typography: "{typography.body}"
  button-cta:
    backgroundColor: "{colors.cta-black}"
    textColor: "{colors.cta-ink}"
    rounded: "{rounded.lg}"
    padding: "13px 48px"
    height: "54px"
    typography: "{typography.title}"
  button-ghost:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "8px 13px"
  card:
    backgroundColor: "{colors.card-stock}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "{spacing.card}"
  input-numeric:
    backgroundColor: "{colors.card-stock}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 4px"
    height: "46px"
    typography: "{typography.numeric}"
  chip:
    backgroundColor: "{colors.card-stock}"
    textColor: "{colors.forge-orange-deep}"
    typography: "{typography.label}"
---

# Design System: Taurifer

## Overview

**Creative North Star: "The Training Ledger"**

Taurifer looks like a warm paper record book that happens to compute. The page
is unbleached paper (#F4F2EF), the type is near-black ink, and figures sit in
aligned columns with `font-variant-numeric: tabular-nums` set globally on
`body` so a column of loads never shifts under its own digits. Content lives on
white card stock bounded by a single hairline rule — never a shadow, never a
second fill. One colour, a hot burnt orange, is the only mark the hand makes,
and it appears where something is live or has changed. Everything else is
paper, ink, and rules.

The system is dense but not cramped. It is built for one hand, standing, at a
machine, between sets: a 560px maximum column, a 44px floor on every
interactive target, and a floating capsule dock that keeps navigation under the
thumb. It is unhurried in a specific way — transitions are 120–260ms, there is
no ornament, and nothing animates to congratulate the reader. The product's
personality is a quiet training partner, and the visual system's job is to stay
out of the way of a number.

Dark is not a second design. It is the same system with the token values
swapped under `:root[data-theme="dark"]` — paper becomes #141310, ink becomes
#F2EFE9, and the orange brightens to #F2703B to hold contrast against a dark
ground. Any rule written here holds in both.

**Key Characteristics:**

- Warm unbleached paper, never pure white as the page
- Hairline rules instead of shadows for every content boundary
- One accent, used sparingly, to mean "live" or "changed"
- Tabular figures everywhere numbers are compared
- Flat at rest; only things that float free of the page are lifted
- Mobile-only column, capped at 560px
- 44px minimum on every target, no exceptions

## Colors

A warm, low-chroma neutral field with exactly one saturated accent, plus two
semantic colours that appear only when they carry meaning.

### Primary

- **Forge Orange** (#E04E14 light / #F2703B dark): the live mark. The active
  tab icon, a focus ring at 12–28% alpha, the CTA's arrow glyph, the wash
  behind a selected entry choice, and the 2px edge on an in-session note. It is
  never a background for text and never a decorative fill.
- **Forge Orange Deep** (#B8410E light / #FF8A3D dark): the same accent when it
  has to *be* text on paper. Chips, accented section labels, and eyebrow links
  use this, because #E04E14 does not clear AA as body-size type on #F4F2EF.

### Neutral

- **Warm Paper** (#F4F2EF light / #141310 dark): the page. Unbleached, slightly
  warm, never #FFF.
- **Card Stock** (#FFFFFF light / #1E1C18 dark): content surfaces that sit on
  the page — cards, sheets, inputs, secondary buttons.
- **Well** (#FAF8F5 light / #191713 dark): a recessed ground for a surface
  inside a surface, where a third border would be one line too many.
- **Ink** (#1B1A17 light / #F2EFE9 dark): all primary text and iconography.
- **Soft Ink** (#6E6A63 light / #ADA79D dark): secondary text, previous-session
  values, inactive tab labels.
- **Faint Ink** (#716D66 light / #99938A dark): eyebrows, card titles, captions,
  the uppercase label tier. Deliberately *darker* than Soft Ink in light mode —
  it sits on small uppercase type, which needs more contrast, not less.
- **Hairline** (#E4E1DA light / #2E2B26 dark): the default 1px boundary.
- **Hairline Strong** (#D9D5CD light / #4A453D dark): the same line where it has
  to survive on a white surface — checkbox and radio strokes, steel buttons.
- **CTA Black** (#161513 light / #DED7CC dark): reserved for the single primary
  action. It inverts between themes while the orange does not.

### Semantic

- **Positive** (#2F7D33 light / #63C267 dark): a personal record, a completed
  target. Never decorative, never a "good job".
- **Danger** (#C93A2B light / #FF6670 dark): destructive actions and validation
  failures only.

### Named Rules

**The One Mark Rule.** Forge Orange marks what is live or what changed —
nothing else. If a screen has more than one orange element competing for
attention, the screen is wrong, not the token. Its scarcity is what makes the
active tab findable.

**The Warm Paper Rule.** The page ground is never pure white and the ink is
never pure black. Both are warmed (#F4F2EF, #1B1A17). A surface that reads cold
against its neighbours has picked the wrong token.

**The Two-Ink Accent Rule.** Orange as a mark and orange as text are different
tokens. Anything that must be read at body size or smaller uses
`--accent-deep`; anything that is a fill, ring, glyph or edge uses `--accent`.
Never substitute one for the other to "keep it consistent" — they exist because
the contrast maths differs.

**The Channel Triplet Rule.** Any translucent use of a theme colour reads its
`--*-rgb` triplet (`rgba(var(--accent-rgb),.12)`), never a hardcoded rgba. This
is what lets a theme swap carry the washes and focus rings with it.

## Typography

**Display / Body Font:** Plex Sans (IBM Plex Sans, variable weight 100–700),
self-hosted woff2, falling back to `system-ui, -apple-system, Segoe UI,
sans-serif`.
**Numeric / Mono Font:** Plex Mono at 400, 500 and 600, falling back to
`ui-monospace, SFMono-Regular, Menlo, monospace`.

**Character:** Plex is a humanist grotesque with slightly mechanical joints —
engineered rather than friendly, legible at 11px, and unremarkable at large
sizes in a way that suits a product that does not want to perform. The Sans/Mono
pairing is one family in two voices: prose in Sans, measurements in Mono.

### Hierarchy

- **Display** (650 weight, 1.875rem, 1.05 line-height, −0.02em): page titles
  and `h2`. The only place negative tracking is used, and only this much.
- **Title** (600 weight, 1.0625rem): the primary CTA label and card headings.
- **Body** (400–500 weight, 0.9375rem / 15px, 1.45 line-height): prose,
  recommendations, list rows.
- **Secondary** (400 weight, 13–14px): previous-session values, deltas,
  captions. Paired with Soft Ink or Faint Ink, never with Ink.
- **Label** (600 weight, 11px, 0.08em, uppercase): eyebrows, card titles,
  section labels, chips. The one sanctioned use of uppercase.
- **Numeric** (500 weight, 16px, Plex Mono, tabular): load, reps and RIR
  inputs. 16px is a floor, not a style choice — iOS zooms the viewport on focus
  below it.

### Named Rules

**The Tabular Figures Rule.** `font-variant-numeric: tabular-nums` is set on
`body` and must never be turned off on a surface that shows a series of
measurements. A column of loads that reflows as digits change is a bug.

**The Uppercase Label Rule.** Uppercase is for the 11px/0.08em label tier only —
eyebrows, card titles, chips, section labels. Never a sentence, never a button,
never a heading.

**The 16px Input Floor Rule.** Any input a thumb will focus on iOS is at least
16px. Below that the browser zooms the page and the lifter loses their place in
the set.

## Layout

One column, centred, capped at `--maxw: 560px`, with a 16px gutter that widens
to the safe-area inset on notched devices. The app is mobile-only by design; the
few `min-width: 700–900px` queries widen the column's breathing room rather than
introducing a second layout. Small-screen queries at 340px and 360px tighten
the set row, which is the densest thing in the app.

Vertical rhythm runs on a 4px base: 4 / 8 / 12 / 14 / 16 / 18 / 26 / 32. Cards
carry a 14px internal inset (`--spacing.card`) applied to children rather than
the card itself, so a full-bleed child can reach the edge. Section labels claim
26–32px above and 12px below, which is what separates one band of the page from
the next without a divider.

The bottom of every scrolling view reserves `--nav` —
`calc(var(--dock-h) + var(--dock-gap))`, 72px — plus the safe-area inset, so the
floating dock never covers the last row. Every floating element (rest bar,
toast, tour, FAB) measures itself against `--nav` rather than inventing its own
offset.

### Named Rules

**The Single Column Rule.** There is one content column and it is 560px wide.
Do not introduce a sidebar, a two-up grid of cards, or a desktop layout. Wider
viewports get more margin, not more columns.

**The Dock Reservation Rule.** Anything fixed to the bottom of the screen
positions itself from `--nav`. A hardcoded bottom offset will collide with the
dock on some device.

## Elevation & Depth

**Flat paper, one floating layer.** Content surfaces are flat, always:
`--shadow` is literally `none`, `.card` sets `box-shadow: none` explicitly, and
depth between a card and the page comes from a 1px hairline plus the
paper/card-stock value difference. Nothing in the content column lifts, on
hover, on focus, or at rest.

The exception is narrow and deliberate: things that float *free* of the page get
real material. The navigation dock is frosted glass —
`backdrop-filter: blur(30px) saturate(180%)` over `rgba(250,248,245,.8)`, with
an inset sheen, an inset bottom line, and two ambient shadows. Bottom sheets
carry a single upward shadow. Both are objects over the page rather than part
of it, and both are the only places glass or shadow appear.

### Shadow Vocabulary

- **Dock ambient** (`0 10px 30px rgba(27,26,23,.13)` + `0 2px 8px rgba(27,26,23,.07)`):
  the floating capsule's separation from the page beneath it.
- **Dock sheen** (`inset 0 1px 0 var(--dock-sheen)`): the top-edge highlight
  that makes the capsule read as glass rather than a flat pill.
- **Sheet lift** (`0 -8px 40px rgba(0,0,0,.18)`): a bottom sheet arriving over
  the page.
- **Focus ring** (`0 0 0 3px rgba(var(--accent-rgb),.12)`, or `.28` on
  checkboxes and radios): not elevation. A ring, drawn with box-shadow because
  it must follow a border radius.

### Named Rules

**The Flat Content Rule.** A card, row, field, well or panel in the content
column has no shadow. If it needs to separate from its surroundings, it gets a
hairline or a different neutral — never a lift.

**The Floating Material Rule.** Glass and shadow are reserved for elements that
float over the page and are not part of it: the dock, sheets, toasts. Adding a
third floating layer is a design decision, not a styling one.

## Shapes

Radii are role-based, not a single scale: 14px (`--radius`) for cards, secondary
buttons and the CTA; 12px for the numeric input group; 8px for small
affordances; 6px for inline marks; 20px on the top corners only for bottom
sheets; `999px` pills for ghost buttons and `50%` for icon buttons and radios.

40 rules sit at `border-radius: 0` on purpose. Where a surface meets the edge of
its parent — a row inside a card, a segment inside a group — the corner is
squared and the parent's `overflow: hidden` does the clipping. This is what
keeps nested surfaces from reading as cards inside cards.

The dock's radius is computed from its own height
(`calc(var(--dock-h)/2)`), so it stays a true capsule if the height changes, and
its buttons take `calc(var(--dock-h)/2 - 6px)` to sit concentrically inside the
6px padding.

### Named Rules

**The No Nested Cards Rule.** A bounded surface does not contain another
bounded surface. Use a squared inner edge with the parent clipping, a `--well`
ground, or a hairline. Never a second card.

**The Concentric Radius Rule.** An element inside a rounded parent computes its
radius from the parent's, minus the padding. Do not eyeball it.

## Components

Restrained and thumb-sure: hairlines and flat fills that stay out of the way,
sized for a standing, one-handed user mid-set.

### Buttons

- **Shape:** gently rounded (14px, `--radius`); ghost variants are full pills
  (999px).
- **Primary (CTA):** full-width, near-black fill (`--cta` #161513) with white
  ink, 54px minimum height, 13px/48px padding, no border. An orange arrow glyph
  is masked into `::after` at the right edge — the accent stays here on purpose,
  because on the near-black fill `--accent` measures ~4.6:1 while
  `--accent-deep` drops to ~3.3:1. Disabled is not opacity: it takes a flat
  `--rule` fill with `--ink-soft` text, so a blocked CTA cannot be mistaken for
  an enabled secondary.
- **Secondary:** card-stock fill, 1px hairline border, ink text, 13px/16px
  padding, 0.9375rem at 600 weight.
- **Ghost:** transparent, pill, 8px/13px, 0.8125rem — for tertiary actions in a
  row.
- **Steel:** card-stock with the stronger hairline, for a secondary that has to
  hold its own on a white surface.
- **Press / focus:** `translateY(1px) scale(.995)` on active, 120ms. Focus is
  the orange ring, never a lift.

### Chips

- **Style:** no fill and no border — 11px uppercase at 0.08em in Forge Orange
  Deep, with a 6px gap for an optional inline glyph. A chip here is a label with
  a colour, not a capsule.

### Cards / Containers

- **Corner:** 14px.
- **Background:** card stock on paper.
- **Shadow:** none, ever. See Elevation.
- **Border:** 1px hairline. The danger variant swaps it for
  `rgba(var(--danger-rgb),.25)`.
- **Padding:** zero on the card; 14px applied to children, so a full-bleed child
  can reach the edge.
- **Card title:** 11px uppercase Faint Ink at 0.08em, 14px inset, 4px below.

### Inputs / Fields

- **Numeric group** (the load field): a 12px-radius, hairline-bordered flex
  strip with `overflow: hidden`, holding a borderless centred input between two
  44px step buttons on a `--bg` ground. The group focuses as one unit —
  `:focus-within` moves the border to Forge Orange and adds the 3px ring; the
  inner input clears its own ring so the two never stack.
- **Set row input:** centred, 16px at 500 weight, 46px minimum height, tabular.
  A suggested-but-unconfirmed value renders in Soft Ink, so the lifter can see
  at a glance which numbers are theirs.
- **Checkbox / radio:** 44px hit area with a 22px drawn box (7px radius, or 50%
  for radio) on a 1.5px strong hairline. The check is a masked SVG that scales
  from 0.2, and the focus ring is drawn on the `::before` box, not the input.

### Navigation

- **Style:** a floating glass capsule, 62px tall, inset 14px from each edge and
  parked 10px above the safe area, with a 4-column grid and 6px internal
  padding. Frosted (`blur(30px) saturate(180%)`), hairline-edged, with an inset
  sheen.
- **Items:** stacked 22px masked icon over an 11px label at 500 weight, no
  uppercase, Soft Ink at rest.
- **Active:** the icon fills with Forge Orange and the button sits in a lighter
  lens; the label stays quiet. Press is `scale(.93)` at 180ms.
- **Absence:** the dock is hidden entirely on Settings, Exercise, Onboarding,
  Library, Preview and Import, and the body's bottom padding drops to the safe
  area alone.
- **Page fade:** a fixed `body::after` gradient sits below the dock and above
  the scrolling content, so rows passing through the gutters beside the capsule
  resolve into paper instead of being cut in half.

### Set Row (signature component)

The densest and most characteristic surface: a set index button, a numeric
group per field, and a save button that changes character by state. Only the set
currently being worked carries the word "Save"; the sets queued behind it hold
the same button at the same size, drawn as the checkmark they are about to
become; a completed set fills with `--cta`. This is the system's clearest
expression of the North Star — the row reads like a line in a ledger being
filled in, not a form being submitted.

## Do's and Don'ts

### Do:

- **Do** name tokens, never raw colour values. Dark theme is a token swap under
  `:root[data-theme="dark"]`; a hardcoded hex strands the rule in light mode.
- **Do** use `rgba(var(--accent-rgb), α)` for any translucent accent, so the
  theme swap carries the wash with it.
- **Do** use `--accent-deep` whenever the accent has to be read as text at body
  size or smaller, and `--accent` for fills, rings, glyphs and edges.
- **Do** keep every interactive target at 44px minimum and every focusable
  input at 16px minimum font size.
- **Do** separate surfaces with a hairline, a `--well` ground, or a squared
  inner edge under the parent's `overflow: hidden`.
- **Do** position anything fixed to the bottom from `--nav`.
- **Do** keep tabular figures on wherever a column of measurements is compared.
- **Do** put motion through `motion-layer.js`, which owns the single
  reduced-motion decision.

### Don't:

- **Don't** put a shadow on a content surface. Flat is the invariant; the dock
  and sheets are the only exceptions and they already exist.
- **Don't** nest a bounded card inside another bounded card.
- **Don't** add a second accent colour, or spend the orange on decoration. It
  means live or changed.
- **Don't** use uppercase outside the 11px/0.08em label tier.
- **Don't** apply negative tracking beyond the −0.02em on the display tier.
  Anything tighter costs legibility at this size.
- **Don't** introduce a second column, a sidebar, or a desktop layout. Wider
  viewports get margin.
- **Don't** add a score, streak, badge, points total, grade or celebration
  animation. The product records and computes; it does not congratulate. This is
  a product-level prohibition, not a stylistic preference.
- **Don't** blanket-`opacity` a disabled control. The CTA's flat
  `--rule`/`--ink-soft` treatment exists because 40% opacity on near-black
  produced a mid-grey that read as enabled.
- **Don't** judge copy length in English alone. Portuguese ships at full parity
  and is usually longer; labels are validated in PT-BR first.
