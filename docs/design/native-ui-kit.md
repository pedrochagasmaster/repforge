# Taurifer native UI kit

**Status:** reference spec, 2026-10-23, re-checked against main 5d2ca411 on 2026-10-24. It describes
no shipped change; the Production column says where main already matches.
**Source:** the native-feel prototype on `origin/design/native-feel`, `docs/design/native-feel/`
(`tokens.css`, `native.css`, `app.css`, `icons.css`, `native.js`, `app.html`, `lab.html`), served
at `127.0.0.1:8772`. Every value below is read from those files; the line owner is named where a
value lives in production already.

**Why this exists.** On 2026-10-23 the owner compared the shipped context menu with the prototype
on a phone and found production less polished: a hard 1px outline instead of a soft material, no
row icons, a boxed preview, different copy, different number styling. The owner asked that every
screen, prototyped or not, meet the prototype's level. This kit is the yardstick. The audit that
applies it is [`native-fidelity-audit-2026-10.md`](native-fidelity-audit-2026-10.md).

**What the kit is not.** It does not change Taurifer's identity. The palette, IBM Plex, the G icon
set, Direction D's layouts and the accent budget all stay. The prototype is built from production's
own `tokens.css`; the difference is in how those tokens are combined: fewer outlines, hairlines
instead of rules, material instead of boxes, icons in menus and rows, one type rhythm.

## The five rules

1. **Separation is space, tone or a hairline, never a box.** The prototype draws no 1px outline
   around a surface. Lists are rows with hairlines between them; floating layers are material plus
   shadow plus a 0.5px edge; sheets are surface plus radius plus shadow. A 1px ring appears only on
   a *control whose extent is the affordance* (secondary button, shelf field, pad, timer pill), and
   there it uses `--boundary-required` because the contract requires 3:1.
2. **Glass only where something scrolls under it.** The dock, the top bar (once content is under
   it), menus, the summary's Done bar and the large-content viewer. Sheets, action sheets and
   dialogs are solid `--surface`. Never glass on glass. `prefers-reduced-transparency` makes all of
   it solid.
3. **One row anatomy.** Every list, menu, picker and setting is the same row: label left, value or
   chevron or icon right, hairline above, pressed wash on touch-down.
4. **Numbers are Plex Mono with tabular figures, at one weight per role.** Training data never
   sits in Plex Sans and never changes weight between neighbouring rows.
5. **Every control answers touch-down.** No transition on the way in, a spring on the way out.

## 1. Materials

| Material | Light | Dark | Blur | Used on | Production |
| --- | --- | --- | --- | --- | --- |
| Dock glass | `--dock-glass` `rgba(250,248,245,.5)` | `rgba(30,28,24,.66)` | `--dock-blur` 14px sat 190% bright 1.05 / dark 18px sat 160% bright .85 | Dock capsule | exists |
| Dock glass, opaque | `--dock-glass-opaque` `.97` | `rgba(24,22,19,.97)` | none | Dock at 200% text, reduced transparency | exists |
| Bar glass | `--bar-glass` `rgba(var(--bg-rgb),.72)` | `rgba(20,19,16,.72)` | `--bar-blur` `blur(20px) saturate(180%)` | Top bar once scrolled, summary Done bar, any bottom action bar over content | exists (#484); only the top bar uses it so far |
| Bar edge | `--bar-edge` `rgba(var(--shadow-rgb),.08)` | `rgba(255,255,255,.08)` | | The 0.5px line under the bar / over a bottom bar, and the menu's hairline ring | exists (#484, #485) |
| Menu glass | `--menu-bg` `rgba(var(--bg-rgb),.86)` | `rgba(36,33,29,.86)` | `--menu-blur` `blur(30px) saturate(180%)` | Context menu, pull-down menu, large-content viewer | exists with the dark tint (#485); production's blur is still **20px**, the kit says 30px |
| Menu backdrop (lift) | `rgba(var(--bg-rgb),.25)` + `blur(12px)` | same formula | 12px | Behind a long-press lift only | exists in phase 4 |
| Scrim | `--scrim` `rgba(27,26,23,.42)` | `rgba(0,0,0,.62)` | none | Sheets, dialogs, action sheets | exists |
| Bottom scroll-edge fade | `linear-gradient(rgba(bg,0), rgba(bg,.92) 62%)`, height `nav + 34px` | same formula | | Under the dock on every docked page | exists (#484) |

Reduced transparency: `--bar-glass: var(--bg)`, `--menu-bg: var(--surface)`,
`--dock-glass: var(--dock-glass-opaque)`.

**Contract note.** Text on glass is `unsupported` for the checker (contract §Contrast), so
glass-borne text keeps a measured fallback: the menu's destructive label already uses
`--menu-destructive-ink` (`#9E2E22` light) for this reason. Every new glass surface needs the same
check against its darkest plausible underlay.

## 2. Surfaces and elevation

| Layer | Ground | Radius | Shadow | Edge | Production token |
| --- | --- | --- | --- | --- | --- |
| Page | `--bg` | – | none | – | exists |
| Grouped list on page | `--bg` (no card) | – | none | hairlines only | exists for Settings (`.settings-row`); most other screens still use `.card` with a 1px `--rule` border |
| Grouped list in sheet | `--surface` | – | none | hairlines | – |
| Sheet | `--surface` | `--radius-prominent` (16px) top | `--elevation-sheet-shadow` | none | exists |
| Action sheet group | `--surface` | 16px | `--elevation-modal-shadow` | none; 0.5px `--rule` between buttons | phase 4 |
| Dialog | `--surface` | 16px | `--elevation-dialog-shadow` | none | exists; some dialogs add a 1px border |
| Menu | `--menu-bg` glass | `--radius-surface` (12px) | `--elevation-popover-shadow, 0 0 0 .5px var(--bar-edge)` | **0.5px hairline in the shadow, never a border** | matches since #485 |
| Lifted row (menu preview) | `--surface` | 12px | `--elevation-drag-shadow` | none | paper card since #485 |
| Shelf (Focus) | `--surface` | 16px top | `--elevation-persistent-shadow` | none | exists |
| Toast | `--ink` ground, `--bg` text | pill | `--elevation-floating-shadow` | none | production uses `--cta` ground and 12px radius |
| Tip callout | `--ink` ground | 12px | `--elevation-tooltip-shadow` | none | owner kept the centred dialog |
| Dock | dock glass | pill | `--elevation-nav-shadow` + `--dock-rim-shadow` | rim, no border | exists |

**Contract amendment (floating boundary).** The layer table gives `floating` a
"theme-aware outward shadow and boundary". Phase 4 read "boundary" as a 1px `--boundary-required`
border, which is exactly what the owner rejected; #485 removed it from the menu. The other floating
layers (`#glossary`, `.glossary`) still draw a border with their shadow. Proposed reading: a floating layer's boundary is
the 0.5px `--bar-edge` hairline plus the shadow, and it is **decorative**: a menu's extent is not
an affordance (its rows are the controls, and they carry text at 4.5:1). This satisfies the
contract's roles (floating still has an outward shadow and an edge) and the prototype's look.

## 3. Radii

| Token | Value | Kit use |
| --- | --- | --- |
| `--radius-compact` | 4px | chart marks only |
| `--radius-control` | 8px | shelf fields, pads, wheel band, the open ledger row, inline tip |
| (segmented) | 9px outer / 7px thumb | segmented control and stepper group. **Propose** `--radius-segment:9px`, `--radius-segment-thumb:7px` |
| `--radius-surface` | 12px | menus, lifted row, tip callout |
| `--radius-prominent` | 16px | sheets, action sheet groups, dialogs |
| (viewer) | 22px | large-content viewer only |
| `--radius-pill` | 999px | every button, the dock, toasts, timer pill, chip |
| `--radius-round` | 50% | close button disc, icon buttons |

Kit rule: buttons are pills. A rectangular 8px or 12px *button* is off-kit (production still has
them: `.ex__skip`, several `.btn` variants in Progress and Program, the danger row in Settings).

## 4. Borders and separators

| Line | Width | Tone | Where | Role |
| --- | --- | --- | --- | --- |
| Row separator on `--bg` | 1px | `--rule` | between list rows (prototype `.li+.li`, `.exrow`) | decorative |
| Hairline | 0.5px | `--rule` | between menu items, action-sheet buttons, sheet header when scrolled | decorative |
| Material edge | 0.5px (as `box-shadow`) | `--bar-edge` | under the bar, around menus, over the summary bar | decorative |
| Separator on `--surface` | 1px | `--rule-on-surface` (`--rule-strong` in dark) | rows inside sheets | decorative |
| Control extent | 1px inset `box-shadow` | `--boundary-required` | secondary button, shelf field, pad, timer pill | required, 3:1 |
| Selected | 2px inset | `--boundary-selected-quiet` (ink) | open ledger row, selected shelf field, seg thumb | selected |
| Switch off | 1.5px inset | `--boundary-required` | switch track | required |

What the kit never draws: a 1px border around a card, a list, a menu, a dialog or a preview; a
border *and* a shadow on the same surface; a full-bleed rule between two groups (space does that);
a separator under the last row of a sheet.

Rows inset their separator to the text column (Settings already does this with
`--settings-inset`). Menu separators between *groups* are an 8px band of `rgba(ink,.06)`
(`.nf-menu__sep`), not a line.

## 5. The list row

| Part | Value | Source |
| --- | --- | --- |
| Min height | 52px single line; 56px menu-free action rows; 60px with a subtitle (day picker); 64px ledger rows | `.li`, `.ed-ex`, `.dayopt`, `.exrow` |
| Padding | 8px vertical, `--gut` (16px) inset from the page | `.li` |
| Gap | 14px label↔value; 12px icon↔label | `.li`, `.ed-ex` |
| Label | `--font-size-body` 16px, regular, `--ink` | |
| Subtitle | `--font-size-caption` 12px, `--ink-soft`, under the label | `.li .sub` |
| Value | `--font-size-body-small` 14px, `--ink-soft`, right aligned, then the chevron | `.li .val` |
| Chevron | 16×16 `.chevron` mask, `--ink-soft`; `chev-down` 16px for a pull-down menu | |
| Leading index | Plex Mono, `--ink-soft`, 1.5–2em column | `.dayopt .n`, `.alt .n` |
| Check | `icon-mask--check` 24px, `--ink` (not accent), springs in on `pressRelease` | `.dayopt .ck` |
| Grip | `icon-mask--grip` 18px, `--ink-faint` | `.ed-ex .grip` |
| Pressed | `--row-pressed-bg` wash, bleeding to the page edges (negative `--gut` margin) | `.row-press.is-pressed` |
| Destructive row | label in `--color-destructive`, no box | `.nf-menu__item.is-destructive` |

Production's Settings rows are 56px with medium-weight labels; the kit says 52px regular. Either
is defensible; the audit lists it as low priority. The real gap is that only Settings uses the row:
Program, History, Progress lists and pickers each draw their own.

## 6. Menus, sheets, action sheets, grouped sections

**Context and pull-down menu** (`.nf-menu`): 230–280px wide; glass as §1; 12px radius; shadow
`--elevation-popover-shadow` + 0.5px `--bar-edge` ring; items 44px min, `10px 16px` padding, 16px
body label left, **20px icon right** (`.nf-ic`) in `currentColor`; 0.5px `--rule` hairline between
items; 8px tinted band between groups; destructive items red with a red icon; a checked
pull-down item shows `icon-mask--check` in the icon slot. The lifted row is a copy at 1.03 on
`--surface` with `--elevation-drag-shadow`, no border, no extra padding beyond the row's own.

Icons the prototype assigns: Why this weight → `target`; Swap exercise → `reset`; Exercise details
→ `dumbbell`; Skip today → `close` (red); Restore → `reset`. Copy: "Swap exercise" (approved), "Skip
today" (approved, `today.skip_today`).

**Sheet** (`.nf-sheet`): grabber 36×5, radius 3, `rgba(ink,.22)`, 6px from the top. Header 52px,
three columns, centred 16px semibold title, or left-aligned `--font-size-section-title` title with
the close button trailing (`--left` variant). **One exit**: the close button is a 44px target with
a 30px disc of `rgba(ink,.07)` holding a 16px `close` icon in `--ink-soft`. No "Got it", no
footer Cancel. Body padding `0 16px` and `safe-area + 20px` at the bottom.

**Action sheet** (`.nf-action`): inset 8px from the sides and bottom; groups at 16px radius on
`--surface` with `--elevation-modal-shadow`; optional header 12px caption title and message,
centred, `--ink-soft`; buttons 56px, centred, `--font-size-subtitle` 18px; 0.5px `--rule`
between; Cancel a separate group in semibold. Pressed: `--well` plus `brightness(.97)`.

**Dialog** (`.tip-dialog`): 24px from the sides, max 360px, 22px padding, 16px radius,
`--elevation-dialog-shadow`, no border, 10px gap; title at section size, body `--ink-soft`.

**Grouped section** (`.group`): 26px above the group; caption `t-label` (11px, semibold, 0.06em,
uppercase, `--ink-soft`) 6px above; rows as §5; footnote 12px `--ink-soft` 8px below. No box.

**Toast**: pill, `--ink` ground, `--bg` text 14px, 10px/18px padding; an action is a 36px pill of
`rgba(bg,.14)` in semibold. Sits `nav + 76px` above the bottom.

## 7. Icons

- **Set:** the G icon set production already ships (`tools/build-icon-masks.mjs`, masks in
  `styles.css`): 24×24 viewBox, `stroke-width` 1.8 (2 for `arrow` and verdict glyphs), round caps
  and joins, `fill="none"`, painted with `currentColor` through `mask`. The dock glyphs
  (`i-log`, `i-stats`, `i-history`, `i-program`) are the same grammar. No new dependency; the
  prototype adds no glyph production lacks.
- **Sizes:** 24px default (`--control-icon-size`); 22px dock and back chevron; **20px in menu
  rows**; 18px stepper and grip; 16px chevrons, close-button glyph and inline checks; 56px in the
  large-content viewer.
- **Placement:** in a menu row the icon is **trailing**, after the label, as iOS does. In a list row
  a drill-in has a trailing chevron; a pull-down a trailing `chev-down` after the value. Leading
  icons are only for a row whose icon *is* its identity (equipment, location). Icon-only buttons
  are 44px targets with no visible box; pressed they dim to 40%.
- **Tone:** icons take the row's ink (`--ink`, `--ink-soft` for chevrons, destructive red for
  destructive rows). An icon that carries state (verdict marks, the logged check) must reach 3:1.

## 8. Type

Plex Sans for language, Plex Mono for training data. The scale is production's; the kit adds
**tracking by role** and **tabular figures everywhere numbers sit in columns**.

| Role | Size token | Weight | Tracking | Line | Kit class |
| --- | --- | --- | --- | --- | --- |
| Large title (root pages) | `--font-size-title` 30 | 600 | −0.02em | 1.1 | `.t-title` |
| Feature title | `--font-size-feature-title` 28 | 600 | −0.01em | 1.1 | `.t-feature` |
| Section title, sheet title (left) | `--font-size-section-title` 24 | 600 | −0.01em | 1.1 | `.t-section` |
| Subtitle | `--font-size-subtitle` 18 | 500 | 0 | 1.4 | `.t-sub` |
| Body, row label, bar title | 16 | 400 (bar/sheet title 600) | 0 | 1.4 | |
| Body small, row value | 14 | 400 | 0 | 1.4 | |
| Caption, row subtitle | 12 | 400 | 0 | 1.4 | `.t-cap` |
| Group label | `--font-size-label` 11 | 600 | +0.06em, uppercase | | `.t-label` |
| Metric (ledger load, stats) | `--font-size-metric` 22 | Mono 400 (ledger), 500 (stats, shelf fields) | 0 | 1.15 | |
| Rest clock | `--font-size-rest-clock` | Mono 600 | −0.02em | | |

**Tabular numerals:** every Plex Mono run gets `font-feature-settings:"tnum"` (`.mono`). Plex Mono
is already monospaced, so this matters mainly where numbers fall back to Sans (captions such as
"Last 42.5 × 12, 12", History dates, Progress axis labels) — the kit puts those in Sans with
`font-variant-numeric: tabular-nums`.

**Number styling in rows** (the owner's context-menu note): the load is Mono 22px regular in `--ink`;
the target ("2 × 9") is Mono 14px in `--ink-soft`, right aligned in a fixed 4.2em column, with
spaces around ×. Production renders the load in a heavier Mono and runs the target inline at a
different size, so the pair reads as one string instead of two columns.
#485 kept the Today ledger's heavier figures as a Direction D deviation (its deviation 1) for the
owner to decide; the same styling recurs on Program and onboarding rows, so it is one decision.

Production has `.t-*`-equivalent sizes but no tracking tokens. **Propose:** `--track-title:-.02em`,
`--track-heading:-.01em`, `--track-label:.06em` (production's group label uses .08em; align on one).

## 9. Spacing

Production's scale (`--space-4 … --space-32`, `--gut:16px`) is the kit's. The prototype's rhythm:

| Gap | Value |
| --- | --- |
| Page gutter | 16px |
| Large title top | `safe-area + 44px` (bar height), 6px below |
| Between groups | 26px |
| Caption → first row | 6px |
| Last row → footnote | 8px |
| Heading → its content | 4px (dayhead), 10–12px (cue, rest) |
| Inside a row | 8px vertical, 14px horizontal gap |
| Shelf | 12px padding, 8px grid gap |
| Floating CTA | `nav + 12px` above the bottom |

Production's Settings uses 34px between groups (documented reason: space is the boundary). The kit
says 26px with the hairline-bounded list. Keep 34px where a group has no list hairlines.

## 10. States

| State | Kit | Production token |
| --- | --- | --- |
| Pressed, primary | `--control-primary-pressed-bg` (`#3A3833` / `#C9C1B4`) + scale `.97`, instant in | exists (phase 1) |
| Pressed, secondary | `--well` ground | phase 1 |
| Pressed, row / menu item / pad | `--row-pressed-bg` (ink 6% / white 7%) | exists (#485) |
| Pressed, icon or text button | opacity .4–.45, no scale | phase 1 |
| Pressed, dock tab | icon scales to .86 | phase 1 |
| Selected, choice | 2px inset `--boundary-selected-quiet` or accent keyline per contract | exists |
| Selected, list option | trailing `check` in `--ink` | – |
| Selected, segmented | raised thumb (`--surface`, dark `#3A3630`) with the seg-thumb shadow | `.native-segments` matches since #485; the older `.segpill`, `.entry-seg` and `.seg` groups do not. **Propose** `--seg-thumb-bg` so all of them share one value |
| Disabled | `--control-disabled-opacity` .4, or the primary disabled ground and ink | exists |
| Focus | `--control-focus-outline` 2px accent, 2px offset; never removed | exists |
| Reduced motion | tone change only, no scale; 160–180ms cross-fade for pushes and sheets | phases 1–3 |

## 11. Motion

Springs, not durations (`native.js` `N.SPRINGS`, production `motion-layer.js` vocabulary):

| Name | k | c | ζ | Job |
| --- | --- | --- | --- | --- |
| `gestureSettle` | 600 | 40 | .82 | a released surface returning to rest |
| `gestureExit` | 700 | 53 | 1.0 | a surface leaving because the gesture asked |
| `navPush` | 700 | 53 | 1.0 | push, sheet open, action sheet open |
| `layoutShift` | 600 | 48 | .98 | indicators (dock lens, seg thumb) |
| `pressRelease` | 900 | 42 | .7 | a pressed control returning; a CSS `linear()` curve, 420ms sample |

Fixed timings the kit uses: bar material fade 180ms linear; bar title 160ms opacity + 200ms
ease-out rise of 4px; menu item press instant; toast 4s; day-pick commit 220ms after the check;
set landing 160ms `cubic-bezier(.2,.7,.2,1)` from opacity .68 and 4px; stepper tick 160ms;
long-press 450ms with a 10px slop; scroller press delay 60ms. Production's sheet still uses a
`.26s cubic-bezier(.2,.7,.2,1)` CSS transition for open (phase 2 kept it for the non-gesture path);
the kit opens on `navPush`.

## 12. New and changed tokens

| Token | Light | Dark | Status |
| --- | --- | --- | --- |
| `--row-pressed-bg` | `rgba(var(--ink-rgb),.06)` | `rgba(255,255,255,.07)` | shipped (#485) |
| `--bar-glass` | `rgba(var(--bg-rgb),.72)` | `rgba(20,19,16,.72)` | shipped (#484) |
| `--bar-blur` | `blur(20px) saturate(180%)` | same | shipped (#484) |
| `--bar-edge` | `rgba(var(--shadow-rgb),.08)` | `rgba(255,255,255,.08)` | shipped |
| `--menu-bg` | `rgba(var(--bg-rgb),.86)` | `rgba(36,33,29,.86)` | shipped (#485) |
| `--menu-blur` | `blur(30px) saturate(180%)` | same | change: 20px → 30px |
| `--elevation-menu-shadow` | `var(--elevation-popover-shadow),0 0 0 .5px var(--bar-edge)` | same | new; names the recipe #485 wrote inline, so `#glossary` and other floating layers can reuse it |
| `--seg-thumb-bg` | `var(--surface)` | `#3A3630` | new |
| `--radius-segment`, `--radius-segment-thumb` | 9px, 7px | same | new |
| `--track-title`, `--track-heading`, `--track-label` | −.02em, −.01em, .06em | same | new |
| `--hairline` | `.5px` | same | new; device pixel on 2× and 3× screens |
| `--toast-bg`, `--toast-ink` | `var(--ink)`, `var(--bg)` | same | new; replaces `--cta` on the toast |

Contrast to verify before landing: `--ink-soft` on `--menu-bg` over the darkest underlay (≥4.5:1);
`--bg` on `--ink` toast (passes, 15.6:1 light, 16.2:1 dark); `--seg-thumb-bg` dark against
`rgba(white,.07)` track (decorative; selection is carried by the 2px quiet ring per the contract).
