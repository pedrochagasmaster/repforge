# Plan 058 semantic contract (P1–P3)

This contract was derived from the production scenarios at `78492da2`: 143
mobile catalog screens, 819 frames, and a fresh Chromium render of every
canonical 390px light/English state. `tools/ui-role-inventory.json` owns the
exact selector and state mapping. Plan 058 P4–P7 migrate and verify consumers;
they do not need to choose a new role vocabulary.

## Layers

| Role | Meaning | Boundary and depth | Existing owners |
| --- | --- | --- | --- |
| `flat` | Ordinary reading, data, grouping, and editable page content | Whitespace or decorative rule; no outward shadow | All base views, Progress evidence, History lists, Program rows |
| `selected` | A chosen option or active destination | Inset high-contrast boundary or fill, no outward shadow | Choice cards, selected chips/tabs, nav destination |
| `floating` | Temporarily raised local tool | Theme-aware outward shadow and boundary | Focus card, menus, toast |
| `modal` | Layer that owns attention and blocks the parent task | Scrim and stronger depth where the layer has a card | Sheets, dialogs, first-run gate, summary |
| `persistent-action` | Actions/navigation kept reachable while content scrolls | Shallow edge and depth; no second raised card inside | Main nav and Program edit dock, summary Done bar |

The first-run gate and full-screen summary are modal by interaction, even
without a visible modal card shadow. The orange outlined recommendation card
is a featured **primary action**, not a selected choice. The normal nav is a
floating capsule; Program edit uses a flush dock variant of the same
`persistent-action` role. A selected child may live inside an elevated layer;
a second outward shadow may not, except for a true positioned overlay. Brand
artwork plates are the exact exceptions in the inventory.

## Controls

The control role answers what an action does. A visual treatment does not
change its role.

| Role | Meaning | Specific distinction |
| --- | --- | --- |
| `primary` | Commits or advances the main task | Start, save, activate, Done, featured recommendation |
| `secondary` | Supporting, reversible action | Replace exercise, retry, copy, add, repeat; not Remove |
| `quiet-navigation` | Changes view, returns, or dismisses without mutating training data | Back/close and drill-in rows; dismiss is an explicit variant |
| `destructive` | Removes or discards user work | Remove, delete, reset, start over; confirmation stays explicit |
| `disclosure` | Expands/collapses content on this view | `aria-expanded`; a chevron on a navigation row does not make it disclosure |
| `selection` | Chooses an option or toggles a reversible state | Choice cards, tabs, switches, Skip/Restore, unit/language/theme |
| `adjustment` | Repeatedly changes a numeric value | Workout stepper is rapid; Program stepper is deliberate |
| `field` | Accepts or edits a typed/native value | Text, numeric, select, textarea; invalid state belongs to the field |

`icon-only` and `disabled` are facets of those roles, not alternative action
intents. Every icon-only control needs an accessible name and the same 44px
target/focus rules. A disabled control has native/ARIA disabled semantics;
its explanation remains readable. `horizontal-scroller` is a region affordance,
not a button role. Shared states are default, hover (pointer only), pressed,
focus-visible, selected where applicable, disabled with reason, validation
error, and loading. A state that does not apply to a role is not synthesized.

The inventory assigns every visible control a role in its catalog state.
Exceptions and variants are selector-exact; they are not blanket style
exemptions. P4 may apply shared role tokens to consumers, but may not map a
stepper to selection or a drill-in chevron to disclosure for styling ease.

## Progress

| Dimension | Denominator and scope | Production selectors |
| --- | --- | --- |
| `block` | Current week within active training block, or block review evidence | `#todayProgram .segbar`, `#programOverview .segbar`, `.blockprogress` |
| `week` | Sessions, trained days, or muscle sets against the current week's plan | `#todayWeek .week-letters`, `#thisWeek .ov-week-bar`, `#sessionSummary .sum-segbar`, `#overviewVolume .vrow__bar` |
| `exercise-set` | Exercise position in an active workout | `#woProgress .segbar--ex` |
| `task` | Step of entry or exercise-picker workflow | `#onbSegbar`, `#libStep` |

`#volumeDash .vrow__bar` changes between `week` (`this-week`) and `block`
(`block-to-date`) with the selected scope. Every listed indicator carries
`data-progress-dimension` and `data-progress-scope` on the rendered element.
The adjacent copy supplies the accessible value. A rest countdown is temporal
status. The Program distribution bar and completed-volume comparison bar are
relative data visualizations with no goal denominator. These three have
selector-exact exclusions from the four-dimensional checker. The review
evidence container uses `block` to identify its scope, but its prose is not a
second numeric progress bar. Do not remove two marks solely because they share
a dimension: prove that their denominator, value, scope, and accessible copy
are duplicates first.

## Type, shape, depth, and color

Plex Sans is for language and controls; Plex Mono is for loads, reps, RIR,
time, counts, and visible technical IDs. Choose by value, not ancestry.
Type sizes are `label` 11px, `caption` 12px, `body-small` 14px, `body/control`
16px, `subtitle` 18px, `title` 30px, `display` 40px at the default root size.
Line heights are tight 1.1, standard 1.4, reading 1.55; weights are 400, 500,
600. Labels/captions cannot be the sole critical control text. Four exact
contextual variants protect established hierarchy: the Plan 054 first-run
headline (38px, 52px wide), its Mono climax data (`min(68px,16vw)`, then
`min(88px,7.5vw)` wide), the Plan 057 summary hero (34px), and the responsive
Mono rest clock (`clamp(32px,10vw,42px)`). Their selectors and catalog owners
are in the inventory; no other surface inherits them by visual resemblance.
P4 maps other unique sizes by semantic job and 200% fit; any truly missing
size is a P2 contract review, not a local literal.

Radius roles are none 0, compact 4px, control 8px, surface 12px,
prominent/modal 16px, pill 999px, round 50%. The old 14px `--radius`/`--r`
value is a named `--radius-legacy` compatibility alias: mapping it to 12px or
16px before consumer review would change approved geometry. The old `--shadow`
is an alias to flat elevation. Elevation tokens use theme-specific shadow
channels so the dark theme never casts pale shadows. `--elevation-focus-shadow`
keeps the movable Focus card's two-level depth;
`--elevation-nav-shadow` preserves the glass dock's edge and drop shadow;
`--elevation-program-dock-shadow` preserves the flush Program edit bar. Modal
sheets and dialogs have separate depth tokens, while the full-screen gate and
summary keep their interaction role without being forced into card depth.
New rules use semantic tokens; P4–P6 remove literal debt and the legacy aliases
after consumers move.

Brand orange remains action/decorative emphasis. Small accent text uses
`--accent-deep`; filled accent uses `--accent-ink`. Improved, declined,
maintained, warning, destructive, disabled explanation, focus, required
boundary, decorative separator, surface, and ink hierarchy are separate
semantic roles even if two currently share a palette value. Required control
boundaries use the high-contrast boundary token. Decorative rules may use
`--rule` and are never the sole cue for a control. Measure text against its
actual composited surface at 4.5:1 (or 3:1 for large text) and required
non-text boundaries, icons, state marks, and focus at 3:1. An unresolved image,
gradient, opacity, or glass background is `unsupported`, not a pass.

The inventory marks choice outlines/fills, field extents, selected tabs/nav,
progress segments, and the rest arc as `required`. Their visual state must
reach the non-text threshold where it supplies the affordance or value.
Read-only row separators, the block-review prose container, relative comparison
tracks with explicit values, and Safari teaching artwork are `decorative`.
These marks may be quieter only because text, labels, or a separate required
indicator carries the meaning. A P4 migration cannot demote a required mark
to decorative merely to make a contrast failure disappear.

## Exact exceptions and catalog reachability

The JSON inventory owns the catalog-state arrays and these seven exact
selectors. None is a subtree waiver.

| Selector | Exception |
| --- | --- |
| `.settings-identity__mark` | Brand artwork's paper and small shadow, not elevated Settings content |
| `.firstrun__logo` | Ground-free mark's dark paper plate |
| `.exdet-art` | Licensed illustration's sampled `mediaBg` and reviewed fallback paper |
| `#restSheet .restdial__arc` | Rest countdown status, not workflow progress |
| `#completedVolume .vrow__bar` | Relative completed-muscle comparison, no target |
| `#volume .vrow__bar` | Relative Program distribution, no target |
| `.safaribar__side` | Decorative Safari teaching artwork, not a live control |

Three owned controls do not appear in the canonical catalog frames:
`#glossary` opens only after a term tap, `#restBar` requires a running timer,
and `#libBar` requires an exercise-picker choice. The inventory marks each
`sourceOnly` with a reason and its affected surface states. Their roles are
frozen, while P4/P7 should add a state when migrating their surface so their
rendered appearance is proven rather than inferred from source.

## Executable ownership

`node tools/check-ui-system.mjs` renders every canonical catalog state and
rejects unmapped/ambiguous visible controls, illegal nested elevation, and
unnamed progress. It reports current CSS literal debt; `--strict-css` becomes
the P6 zero-debt gate. `node test/ui-system.mjs` seeds bad literal, contrast,
focus, boundary, selector, and dimension cases and proves rejection. P5 expands
rendered role coverage to all locales/themes/states. P4 migrates one surface
at a time in the order stated by Plan 058. P6 removes aliases and closes
literal debt; P7 regenerates/reviews the entire catalog and required device
matrix. This document and the inventory are the role authority until an
explicit P2/P3 contract review changes them.
